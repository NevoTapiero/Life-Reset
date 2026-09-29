import { NextResponse } from "next/server";
import { userFromBearer, getIntegration, paidRefs } from "@/lib/integrations/server";
import {
  ApiIssue,
  canWriteTasks,
  eventStart,
  eventsEverywhere,
  explainIssues,
  freshAccessToken,
  localDayRange,
  openTasks,
} from "@/lib/integrations/google";

export const runtime = "nodejs";
export const maxDuration = 60;

// The player's real schedule and open tasks, read live, with what has already
// been paid for. Nothing is awarded here: meetings pay only when the player
// marks them done, through /api/integrations/google/complete.

export async function GET(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const row = await getIntegration(uid, "google");
  if (!row) return NextResponse.json({ connected: false, events: [], tasks: [] });
  const token = await freshAccessToken(uid);
  if (!token) return NextResponse.json({ connected: false, reconnect: true, events: [], tasks: [] });

  const { start, end } = localDayRange(7);
  const issues: ApiIssue[] = [];
  const [events, tasks, paid] = await Promise.all([
    eventsEverywhere(token, start.toISOString(), end.toISOString(), issues),
    openTasks(token, issues),
    paidRefs(uid, ["google_calendar", "google_tasks"]),
  ]);

  const now = Date.now();
  const todayEnd = start.getTime() + 86400_000;
  return NextResponse.json({
    connected: true,
    canWrite: canWriteTasks(row.scope),
    problem: explainIssues(issues),
    events: events.slice(0, 25).map((e) => {
      const at = eventStart(e);
      return {
        id: e.id,
        calendarId: e.calendarId ?? "primary",
        title: (e.summary ?? "Busy").slice(0, 90),
        start: e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00` : null),
        allDay: !e.start?.dateTime,
        today: at >= start.getTime() && at < todayEnd,
        started: Number.isFinite(at) && at <= now,
        done: paid.has(`event:${e.id}`),
      };
    }),
    tasks: tasks.map((t) => ({
      id: t.id,
      listId: t.listId ?? "",
      title: t.title.slice(0, 90),
      due: t.due ?? null,
      done: paid.has(`task:${t.id}`),
    })),
  });
}
