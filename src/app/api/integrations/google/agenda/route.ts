import { NextResponse } from "next/server";
import { userFromBearer, getIntegration, paidAt, revokeXp } from "@/lib/integrations/server";
import {
  ApiIssue,
  GTask,
  canWriteTasks,
  eventStart,
  eventsEverywhere,
  explainIssues,
  freshAccessToken,
  getTask,
  localDayRange,
  openTasks,
} from "@/lib/integrations/google";

export const runtime = "nodejs";
export const maxDuration = 60;

// The player's real schedule and task list, read live, with what has been paid.
// Meetings pay only when marked done, through /api/integrations/google/complete.
//
// XP follows the checkbox, not the task's existence:
//  - unchecked (in the app or in Google itself) -> the XP is taken back
//  - deleted after being checked                 -> the XP stays

// Google's task list can lag a few seconds behind a change we just made, so a
// payment this fresh is never treated as "unchecked in Google".
const SETTLE_MS = 2 * 60 * 1000;

export async function GET(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const row = await getIntegration(uid, "google");
  if (!row) return NextResponse.json({ connected: false, events: [], tasks: [] });
  const token = await freshAccessToken(uid);
  if (!token) return NextResponse.json({ connected: false, reconnect: true, events: [], tasks: [] });

  const { start, end } = localDayRange(7);
  const issues: ApiIssue[] = [];
  // Only open tasks come from Google. Finished ones are read by the app from its
  // own ledger, so deleting a finished task in Google never removes it here.
  const [events, open, paid] = await Promise.all([
    eventsEverywhere(token, start.toISOString(), end.toISOString(), issues),
    openTasks(token, issues),
    paidAt(uid, ["google_calendar", "google_tasks"]),
  ]);

  // Paid but open again: the player unchecked it in Google. Confirm with Google
  // one task at a time before taking anything back.
  const now = Date.now();
  let revoked = 0;
  for (const t of open) {
    const at = paid.get(`task:${t.id}`);
    if (at === undefined || now - at < SETTLE_MS || !t.listId) continue;
    const fresh = await getTask(token, t.listId, t.id, issues);
    if (fresh?.status !== "needsAction") continue;
    revoked += await revokeXp(uid, "google_tasks", `task:${t.id}`);
    paid.delete(`task:${t.id}`);
  }

  // a payment still settling can briefly show as open: it is done, not open
  const tasks: GTask[] = open.filter((t) => !paid.has(`task:${t.id}`));

  const todayEnd = start.getTime() + 86400_000;
  return NextResponse.json({
    connected: true,
    canWrite: canWriteTasks(row.scope),
    problem: explainIssues(issues),
    revoked,
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
    tasks: tasks.slice(0, 30).map((t) => ({
      id: t.id,
      listId: t.listId ?? "",
      title: t.title.slice(0, 90),
      due: t.due ?? null,
    })),
  });
}
