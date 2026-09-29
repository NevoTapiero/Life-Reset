import { getIntegration, touchSync, awardXp, paidRefs } from "./server";
import { freshAccessToken as googleToken, completedTasksSince, judge, GTask, GEvent } from "./google";
import { recentExercise, recentSleep as healthSleep, dailySteps, durationMinutes, pointId } from "./health";
import {
  freshAccessToken as whoopToken,
  recentSleep,
  recentRecovery,
  recentWorkouts,
} from "./whoop";

// Shared sync routines so a single request can refresh every connected service.
// Budgets are deliberately small: each sync must finish well inside the
// serverless time limit, or nothing gets recorded at all.

const TASK_BASE = 5;
const EVENT_BASE = 3;
const MAX_PER_KIND = 6;

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

export async function payTask(uid: string, t: GTask): Promise<{ paid: boolean; xp: number; reason: string }> {
  const verdict = await judge(t.title, "task", TASK_BASE);
  const xp = TASK_BASE + verdict.xp;
  const paid = await awardXp(uid, "google_tasks", `task:${t.id}`, xp, t.title.slice(0, 140));
  return { paid, xp, reason: verdict.reason };
}

export async function payEvent(uid: string, e: GEvent): Promise<{ paid: boolean; xp: number; reason: string }> {
  const title = e.summary?.trim() || "Calendar event";
  const verdict = await judge(title, "event", EVENT_BASE);
  const xp = EVENT_BASE + verdict.xp;
  const paid = await awardXp(uid, "google_calendar", `event:${e.id}`, xp, title.slice(0, 140));
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

  // Always look back three days rather than from the last sync, so anything
  // missed while the connection was broken still gets picked up.
  const since = new Date(Date.now() - 3 * 86400_000);
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

// --- Google Health --------------------------------------------------------
// Workouts pay by active minutes, sleep by hours actually asleep, and steps by
// the thousand, but only for finished days so a half-walked day is not locked
// in at breakfast.

export type HealthSync = { connected: boolean; newItems: number; xpGained: number; error?: string };

function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

export async function syncHealth(uid: string): Promise<HealthSync> {
  const empty = { connected: false, newItems: 0, xpGained: 0 };
  const row = await getIntegration(uid, "ghealth");
  if (!row) return empty;
  const token = await googleToken(uid, "ghealth");
  if (!token) return { ...empty, error: "reconnect" };

  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  const today = ymd(new Date());
  const threeDaysAgo = ymd(new Date(Date.now() - 3 * 86400_000));

  const [workouts, sleeps, steps] = await Promise.all([
    recentExercise(token, since),
    healthSleep(token, since),
    dailySteps(token, threeDaysAgo, today), // end is exclusive: today is left out
  ]);

  let xpGained = 0;
  let newItems = 0;
  const grant = async (source: string, ref: string, xp: number, reason: string) => {
    if (xp <= 0) return;
    if (await awardXp(uid, source, ref, xp, reason)) {
      xpGained += xp;
      newItems++;
    }
  };

  for (const w of workouts) {
    const minutes = durationMinutes(w.exercise?.activeDuration);
    if (minutes < 10) continue; // a walk to the car is not a workout
    const label = w.exercise?.displayName || prettyType(w.exercise?.exerciseType) || "Workout";
    await grant("health_workout", `workout:${pointId(w.name)}`, Math.min(40, Math.round(minutes * 0.6)), `${label} · ${minutes} min`);
  }
  for (const s of sleeps) {
    const asleep = Number(s.sleep?.summary?.minutesAsleep ?? 0);
    if (asleep < 180) continue; // naps and broken nights earn nothing
    const hours = asleep / 60;
    // 7 to 9 hours is the target band; outside it pays less
    const xp = hours >= 7 && hours <= 9 ? 15 : hours >= 6 ? 10 : 5;
    await grant("health_sleep", `sleep:${pointId(s.name)}`, xp, `Slept ${hours.toFixed(1)} h`);
  }
  for (const d of steps) {
    if (d.date >= today || d.steps < 3000) continue;
    await grant("health_steps", `steps:${d.date}`, Math.min(25, Math.floor(d.steps / 1000)), `${d.steps.toLocaleString("en-US")} steps`);
  }

  await touchSync(uid, "ghealth");
  return { connected: true, newItems, xpGained };
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

  const since = (row.last_sync
    ? new Date(new Date(row.last_sync).getTime() - 3600_000)
    : new Date(Date.now() - 7 * 86400_000)
  ).toISOString();

  const [sleeps, recoveries, workouts] = await Promise.all([
    recentSleep(token, since),
    recentRecovery(token, since),
    recentWorkouts(token, since),
  ]);

  let xpGained = 0;
  let newItems = 0;
  const grant = async (source: string, ref: string, xp: number, reason: string) => {
    if (xp <= 0) return;
    if (await awardXp(uid, source, ref, xp, reason)) {
      xpGained += xp;
      newItems++;
    }
  };

  for (const s of sleeps) {
    if (s.nap || s.score_state !== "SCORED") continue;
    await grant("whoop_sleep", `sleep:${s.id}`, Math.round((s.score?.sleep_performance_percentage ?? 0) / 5), "Sleep");
  }
  for (const r of recoveries) {
    if (r.score_state !== "SCORED") continue;
    await grant("whoop_recovery", `recovery:${r.cycle_id}`, Math.round((r.score?.recovery_score ?? 0) / 5), "Recovery");
  }
  for (const w of workouts) {
    if (w.score_state !== "SCORED") continue;
    await grant("whoop_workout", `workout:${w.id}`, Math.round((w.score?.strain ?? 0) * 2), w.sport_name ?? "Workout");
  }

  await touchSync(uid, "whoop");
  return { connected: true, newItems, xpGained };
}
