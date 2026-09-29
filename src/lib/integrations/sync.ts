import { getIntegration, touchSync, awardXp } from "./server";
import {
  freshAccessToken as googleToken,
  completedTasksSince,
  eventsEverywhere,
  localDayRange,
  judge,
} from "./google";
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

export async function syncGoogle(uid: string): Promise<GoogleSync> {
  const empty = { connected: false, newTasks: 0, newEvents: 0, xpGained: 0 };
  const row = await getIntegration(uid, "google");
  if (!row) return empty;
  const token = await googleToken(uid);
  if (!token) return { ...empty, error: "reconnect" };

  // Always look back three days rather than from the last sync. Awards are keyed
  // on the task id, so re-reading the same task cannot pay twice, and anything
  // missed while the connection was broken still gets picked up.
  const since = new Date(Date.now() - 3 * 86400_000);
  const { start: dayStart, end: dayEnd } = localDayRange();

  const [tasks, events] = await Promise.all([
    completedTasksSince(token, since.toISOString()),
    eventsEverywhere(token, dayStart.toISOString(), dayEnd.toISOString()),
  ]);

  const pickedTasks = tasks.slice(0, MAX_PER_KIND);
  const pickedEvents = events.filter((e) => e.summary?.trim()).slice(0, MAX_PER_KIND);

  const [taskJudged, eventJudged] = await Promise.all([
    Promise.all(pickedTasks.map((t) => judge(t.title, "task", TASK_BASE))),
    Promise.all(pickedEvents.map((e) => judge(e.summary!, "event", EVENT_BASE))),
  ]);

  let xpGained = 0;
  let newTasks = 0;
  let newEvents = 0;

  for (let i = 0; i < pickedTasks.length; i++) {
    const t = pickedTasks[i];
    const xp = TASK_BASE + taskJudged[i].xp;
    if (await awardXp(uid, "google_tasks", `task:${t.id}`, xp, t.title.slice(0, 140))) {
      xpGained += xp;
      newTasks++;
    }
  }
  for (let i = 0; i < pickedEvents.length; i++) {
    const e = pickedEvents[i];
    const xp = EVENT_BASE + eventJudged[i].xp;
    if (await awardXp(uid, "google_calendar", `event:${e.id}`, xp, e.summary!.slice(0, 140))) {
      xpGained += xp;
      newEvents++;
    }
  }

  await touchSync(uid, "google");
  return { connected: true, newTasks, newEvents, xpGained };
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
