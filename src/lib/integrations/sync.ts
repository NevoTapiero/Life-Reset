import { getIntegration, touchSync, awardXp, paidRefs, paidMeta, rescoreXp, recalcPlayer, ledgerTotal } from "./server";
import { cardXp } from "@/lib/game";
import { TrackedKind, sleepRated, stepsRated, workoutRated } from "@/lib/pricing";
import { freshAccessToken as googleToken, completedTasksSince, judge, localDayRange, GTask, GEvent } from "./google";
import { recentExercise, recentSleep as healthSleep, dailySteps, exerciseMinutes, pointId, workoutXp } from "./health";
import {
  freshAccessToken as whoopToken,
  recentSleep,
  recentRecovery,
  recentWorkouts,
} from "./whoop";

// Shared sync routines so a single request can refresh every connected service.
// Budgets are deliberately small: each sync must finish well inside the
// serverless time limit, or nothing gets recorded at all.

// Google items are real-life chores, not habits: they pay half of what the
// Judge's 1-50 effort score says, on top of a small flat base.
const TASK_BASE = 3;
const EVENT_BASE = 2;
const JUDGE_SHARE = 0.5;
const MAX_PER_KIND = 6;

// Nothing from before the day a service was connected ever counts: the day
// starts at local midnight, so the rest of that day still does. Bounded to a
// week so a long-idle connection can't trigger an unbounded catch-up.
export function countFrom(row: { connected_at?: string | null }): Date {
  const connected = row.connected_at ? new Date(row.connected_at) : new Date();
  const dayStart = localDayRange(1, connected).start.getTime();
  return new Date(Math.max(dayStart, Date.now() - 7 * 86400_000));
}

export type GoogleSync = {
  connected: boolean;
  newTasks: number;
  newEvents: number;
  xpGained: number;
  error?: string;
};

// Every item passes through the Judge before a single point is granted. The
// ledger key is the item's own id, so ticking a task in the app and Google
// reporting it completed later can never pay twice.

// The ledger row keeps the task's list id, so the finished task stays in the
// app (and can still be unchecked) even after it is deleted in Google.
export async function payTask(uid: string, t: GTask): Promise<{ paid: boolean; xp: number; reason: string }> {
  const verdict = await judge(t.title, "task", 10);
  const xp = TASK_BASE + Math.round(verdict.xp * JUDGE_SHARE);
  const paid = await awardXp(uid, "google_tasks", `task:${t.id}`, xp, t.title.slice(0, 140), {
    listId: t.listId ?? null,
  });
  return { paid, xp, reason: verdict.reason };
}

export async function payEvent(uid: string, e: GEvent): Promise<{ paid: boolean; xp: number; reason: string }> {
  const title = e.summary?.trim() || "Calendar event";
  const verdict = await judge(title, "event", 6);
  const xp = EVENT_BASE + Math.round(verdict.xp * JUDGE_SHARE);
  const paid = await awardXp(uid, "google_calendar", `event:${e.id}`, xp, title.slice(0, 140), {
    calendarId: e.calendarId ?? null,
  });
  return { paid, xp, reason: verdict.reason };
}

// Calendar events are never paid here: a meeting only earns XP once the player
// marks it done (see /api/integrations/google/complete). Tasks the player ticks
// off inside Google itself are still picked up, judged and paid.
export async function syncGoogle(uid: string): Promise<GoogleSync> {
  const empty = { connected: false, newTasks: 0, newEvents: 0, xpGained: 0 };
  const row = await getIntegration(uid, "google");
  if (!row) return empty;
  const token = await googleToken(uid);
  if (!token) return { ...empty, error: "reconnect" };

  // Everything completed since the connection, not just since the last sync, so
  // anything missed while the connection was broken still gets picked up.
  const since = countFrom(row);
  const [tasks, paid] = await Promise.all([
    completedTasksSince(token, since.toISOString()),
    paidRefs(uid, ["google_tasks"]),
  ]);

  // skip what is already paid before asking the Judge, which is the slow part
  const fresh = tasks.filter((t) => !paid.has(`task:${t.id}`)).slice(0, MAX_PER_KIND);
  const results = await Promise.all(fresh.map((t) => payTask(uid, t)));

  let xpGained = 0;
  let newTasks = 0;
  for (const r of results) {
    if (r.paid) {
      xpGained += r.xp;
      newTasks++;
    }
  }

  await touchSync(uid, "google");
  return { connected: true, newTasks, newEvents: 0, xpGained };
}

// --- watch items: the same price and the same card as a quest ---------------
// A watch reports steps, sleep and workouts; each becomes a ledger row carrying
// { kind, rated, day }. The database (recalc_player) pays it through the same
// 7-day card as a quest, counting consecutive days of that kind, so 10,000
// steps pays exactly what a "10k steps" quest pays on the same day of its run.

type WatchItem = { source: string; kind: TrackedKind; ref: string; rated: number; day: string; reason: string; extra?: Record<string, unknown> };

// Record (or re-price) watch items, then let the database run the cards.
// Returns how many were new and how the player's XP from these sources moved.
// `repriceOnly`: only bring already-paid rows onto the current rule, never add
// new ones (a backfill must not pay for anything from before the connection).
async function payWatchItems(
  uid: string,
  sources: string[],
  items: WatchItem[],
  repriceOnly = false,
): Promise<{ newItems: number; xpGained: number }> {
  const before = await ledgerTotal(uid, sources);
  const paid = new Map<string, Record<string, unknown>>();
  for (const s of sources) for (const [ref, meta] of await paidMeta(uid, s)) paid.set(`${s}|${ref}`, meta);

  let newItems = 0;
  let changed = false;
  for (const it of items) {
    if (it.rated <= 0) {
      // below the habit's bar (e.g. under 5 hours of sleep): the quest would pay
      // nothing, so the watch pays nothing. An older payout for it is zeroed.
      const prev = paid.get(`${it.source}|${it.ref}`);
      if (prev && prev.rated !== 0) {
        await rescoreXp(uid, it.source, it.ref, 0, it.reason, { kind: it.kind, rated: 0, day: it.day });
        changed = true;
      }
      continue;
    }
    const meta = { kind: it.kind, rated: it.rated, day: it.day, ...(it.extra ?? {}) };
    const prev = paid.get(`${it.source}|${it.ref}`);
    // the card fixes the amount right after; day 1 is a fair placeholder
    const placeholder = cardXp(it.rated, 1);
    if (!prev) {
      if (repriceOnly) continue;
      if (await awardXp(uid, it.source, it.ref, placeholder, it.reason, meta)) {
        newItems++;
        changed = true;
      }
    } else if (prev.rated !== it.rated || prev.day !== it.day || prev.kind !== it.kind) {
      // paid under an older rule: bring it onto the shared price and card
      await rescoreXp(uid, it.source, it.ref, placeholder, it.reason, meta);
      changed = true;
    }
  }
  if (changed) await recalcPlayer(uid);
  return { newItems, xpGained: (await ledgerTotal(uid, sources)) - before };
}

// --- Google Health --------------------------------------------------------

export type HealthSync = { connected: boolean; newItems: number; xpGained: number; error?: string };

function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

// `sinceOverride` lets a one-time backfill re-price items older than the
// connection window; normal syncs never pass it.
export async function syncHealth(uid: string, sinceOverride?: Date, repriceOnly = false): Promise<HealthSync> {
  const empty = { connected: false, newItems: 0, xpGained: 0 };
  const row = await getIntegration(uid, "ghealth");
  if (!row) return empty;
  const token = await googleToken(uid, "ghealth");
  if (!token) return { ...empty, error: "reconnect" };

  const from = sinceOverride ?? countFrom(row);
  const since = from.toISOString();
  const today = ymd(new Date());
  // steps are whole days: count from the day of connection, finished days only
  const firstDay = ymd(from);

  const [workouts, sleeps, steps] = await Promise.all([
    recentExercise(token, since),
    healthSleep(token, since), // sessions that ended after connecting
    firstDay < today ? dailySteps(token, firstDay, today) : Promise.resolve([]), // end exclusive: today left out
  ]);

  const items: WatchItem[] = [];
  // Iftach's penalties live in their own rows (<source>_penalty), so the shared
  // price table and card never overwrite them and they never overwrite a payout.
  const penalties: { source: string; ref: string; xp: number; reason: string }[] = [];
  for (const w of workouts) {
    const minutes = exerciseMinutes(w);
    if (minutes < 10) continue; // a walk to the car is not a workout
    const label = w.exercise?.displayName || prettyType(w.exercise?.exerciseType) || "Workout";
    const { xp: score, basis } = workoutXp(w);
    items.push({
      source: "health_workout",
      kind: "workout",
      ref: `workout:${pointId(w.name)}`,
      rated: workoutRated(score),
      day: ymd(new Date(w.exercise?.interval?.startTime ?? Date.now())),
      reason: `${label} · ${minutes} min · ${basis}`,
      extra: { scoring: "blend-v3", basis },
    });
  }
  for (const s of sleeps) {
    const hours = Number(s.sleep?.summary?.minutesAsleep ?? 0) / 60;
    const ref = `sleep:${pointId(s.name)}`;
    items.push({
      source: "health_sleep",
      kind: "sleep",
      ref,
      rated: sleepRated(hours), // a short night pays a little, under 5 hours nothing
      day: ymd(new Date(s.sleep?.interval?.endTime ?? Date.now())), // the morning you woke up
      reason: `Slept ${hours.toFixed(1)} h`,
    });
    // a real night (3 h+) under 6 hours is a penalty on top, not just no prize
    if (hours >= 3 && hours < 6)
      penalties.push({ source: "health_sleep_penalty", ref, xp: -10, reason: `Slept ${hours.toFixed(1)} h · short night, you're running tired` });
  }
  for (const d of steps) {
    if (d.date < firstDay || d.date >= today) continue;
    items.push({
      source: "health_steps",
      kind: "steps",
      ref: `steps:${d.date}`,
      rated: stepsRated(d.steps),
      day: d.date,
      reason: `${d.steps.toLocaleString("en-US")} steps`,
    });
  }

  const r = await payWatchItems(uid, ["health_workout", "health_sleep", "health_steps"], items, repriceOnly);
  if (!repriceOnly) {
    for (const pen of penalties)
      if (await awardXp(uid, pen.source, pen.ref, pen.xp, pen.reason)) {
        r.xpGained += pen.xp;
        r.newItems++;
      }
  }
  await touchSync(uid, "ghealth");
  return { connected: true, ...r };
}

function prettyType(t: string | undefined): string {
  if (!t) return "";
  return t.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export type WhoopSync = { connected: boolean; newItems: number; xpGained: number; error?: string };

export async function syncWhoop(uid: string): Promise<WhoopSync> {
  const empty = { connected: false, newItems: 0, xpGained: 0 };
  const row = await getIntegration(uid, "whoop");
  if (!row) return empty;
  const token = await whoopToken(uid);
  if (!token) return { ...empty, error: "reconnect" };

  // WHOOP filters by record start, so this counts only what began after connecting
  const since = countFrom(row).toISOString();

  const [sleeps, recoveries, workouts] = await Promise.all([
    recentSleep(token, since),
    recentRecovery(token, since),
    recentWorkouts(token, since),
  ]);

  // Sleep and workouts are quest kinds: same price and card as a quest.
  const items: WatchItem[] = [];
  const penalties: { source: string; ref: string; xp: number; reason: string }[] = [];
  for (const s of sleeps) {
    if (s.nap || s.score_state !== "SCORED") continue;
    const st = s.score?.stage_summary;
    const hours =
      ((st?.total_light_sleep_time_milli ?? 0) + (st?.total_slow_wave_sleep_time_milli ?? 0) + (st?.total_rem_sleep_time_milli ?? 0)) /
      3_600_000;
    items.push({
      source: "whoop_sleep",
      kind: "sleep",
      ref: `sleep:${s.id}`,
      rated: sleepRated(hours),
      day: ymd(new Date(s.end ?? Date.now())),
      reason: `Slept ${hours.toFixed(1)} h`,
    });
    // WHOOP's own sleep performance under 50% costs XP: 0% -> -20
    const perf = s.score?.sleep_performance_percentage ?? 0;
    if (perf < 50)
      penalties.push({ source: "whoop_sleep_penalty", ref: `sleep:${s.id}`, xp: Math.round((perf - 50) / 2.5), reason: `Sleep ${Math.round(perf)}% · you're running tired` });
  }
  for (const w of workouts) {
    if (w.score_state !== "SCORED") continue;
    // the same three signals as Google Health: heart zones, calories, time.
    // WHOOP zones 1-2 count as light, 3 moderate, 4 vigorous, 5 peak.
    const zd = w.score?.zone_durations;
    const sec = (ms?: number) => `${Math.round((ms ?? 0) / 1000)}s`;
    const asHealth = {
      name: w.id,
      exercise: {
        interval: { startTime: w.start, endTime: w.end },
        displayName: w.sport_name,
        metricsSummary: {
          caloriesKcal: w.score?.kilojoule ? w.score.kilojoule / 4.184 : undefined,
          heartRateZoneDurations: zd
            ? {
                lightTime: sec((zd.zone_one_milli ?? 0) + (zd.zone_two_milli ?? 0)),
                moderateTime: sec(zd.zone_three_milli),
                vigorousTime: sec(zd.zone_four_milli),
                peakTime: sec(zd.zone_five_milli),
              }
            : undefined,
        },
      },
    };
    const rich = !!zd || !!w.score?.kilojoule;
    // strain (0 to 21) only when WHOOP sent nothing else; a hard session (~12) lands where a hard run does
    const { xp: score, basis } = rich ? workoutXp(asHealth) : { xp: (w.score?.strain ?? 0) * 3, basis: `strain ${(w.score?.strain ?? 0).toFixed(1)}` };
    items.push({
      source: "whoop_workout",
      kind: "workout",
      ref: `workout:${w.id}`,
      rated: workoutRated(score),
      day: ymd(new Date(w.start ?? Date.now())),
      reason: `${w.sport_name ?? "Workout"} · ${basis}`,
      extra: { scoring: "blend-v3", basis },
    });
  }
  const r = await payWatchItems(uid, ["whoop_sleep", "whoop_workout"], items);

  // Recovery has no quest twin: it keeps its own payout. Zero at 33, WHOOP's
  // own red/yellow line: green pays up to +20, red costs up to -10.
  let xpGained = r.xpGained;
  let newItems = r.newItems;
  for (const rec of recoveries) {
    if (rec.score_state !== "SCORED") continue;
    const score = rec.score?.recovery_score ?? 0;
    const xp = Math.round((score - 33) / 3.35);
    const reason = `Recovery ${Math.round(score)}%${xp < 0 ? " · in the red" : ""}`;
    if (xp !== 0 && (await awardXp(uid, "whoop_recovery", `recovery:${rec.cycle_id}`, xp, reason))) {
      xpGained += xp;
      newItems++;
    }
  }
  for (const pen of penalties)
    if (await awardXp(uid, pen.source, pen.ref, pen.xp, pen.reason)) {
      xpGained += pen.xp;
      newItems++;
    }

  await touchSync(uid, "whoop");
  return { connected: true, newItems, xpGained };
}
