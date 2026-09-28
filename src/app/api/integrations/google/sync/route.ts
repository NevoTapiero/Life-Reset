import { NextResponse } from "next/server";
import { userFromBearer, getIntegration, touchSync, awardXp } from "@/lib/integrations/server";
import { freshAccessToken, completedTasksSince, eventsBetween, judge } from "@/lib/integrations/google";

export const runtime = "nodejs";
export const maxDuration = 60;

const TASK_BASE = 5; // completing a Google task
const EVENT_BASE = 3; // per scheduled event (a busier calendar earns more)
const MAX_ITEMS = 10; // per kind, to bound work per sync

// Pull the user's recently completed Google Tasks and today's Calendar events,
// award XP for anything new (base + the Judge's bonus), and report the totals.
export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const row = await getIntegration(uid, "google");
  if (!row) return NextResponse.json({ connected: false });

  const token = await freshAccessToken(uid);
  if (!token) return NextResponse.json({ connected: false, error: "reconnect" }, { status: 200 });

  // look back to the last sync, or the past 3 days on the first run
  const since = row.last_sync
    ? new Date(new Date(row.last_sync).getTime() - 60_000)
    : new Date(Date.now() - 3 * 86400_000);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400_000);

  const [tasks, events] = await Promise.all([
    completedTasksSince(token, since.toISOString()),
    eventsBetween(token, dayStart.toISOString(), dayEnd.toISOString()),
  ]);

  const pickedTasks = tasks.slice(0, MAX_ITEMS);
  const pickedEvents = events.filter((e) => e.summary?.trim()).slice(0, MAX_ITEMS);

  // judge everything in parallel so the sync stays fast
  const [taskJudged, eventJudged] = await Promise.all([
    Promise.all(pickedTasks.map((t) => judge(t.title, "task", TASK_BASE))),
    Promise.all(pickedEvents.map((e) => judge(e.summary!, "event", EVENT_BASE))),
  ]);

  let xpGained = 0;
  let newTasks = 0;
  let newEvents = 0;

  const awards = [
    ...pickedTasks.map((t, i) => ({
      ref: `task:${t.id}`,
      xp: TASK_BASE + taskJudged[i].xp,
      reason: `Google task: ${t.title}`.slice(0, 140),
      kind: "task" as const,
    })),
    ...pickedEvents.map((e, i) => ({
      ref: `event:${e.id}`,
      xp: EVENT_BASE + eventJudged[i].xp,
      reason: `Calendar: ${e.summary}`.slice(0, 140),
      kind: "event" as const,
    })),
  ];

  for (const a of awards) {
    const source = a.kind === "task" ? "google_tasks" : "google_calendar";
    const granted = await awardXp(uid, source, a.ref, a.xp, a.reason);
    if (granted) {
      xpGained += a.xp;
      if (a.kind === "task") newTasks++;
      else newEvents++;
    }
  }

  await touchSync(uid, "google");
  return NextResponse.json({ connected: true, newTasks, newEvents, xpGained });
}
