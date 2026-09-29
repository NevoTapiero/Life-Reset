import { NextResponse } from "next/server";
import { userFromBearer, getIntegration } from "@/lib/integrations/server";
import {
  ApiIssue,
  canWriteTasks,
  completeTask,
  eventStart,
  explainIssues,
  freshAccessToken,
  getEvent,
  getTask,
  isCannedCalendar,
} from "@/lib/integrations/google";
import { payEvent, payTask } from "@/lib/integrations/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// The player marks a task or a meeting done from inside the app. The browser
// sends ids only: every rule below is checked against what Google itself says,
// and the Judge prices the item before any XP moves.

const GRACE_MS = 3 * 86400_000; // a meeting can be logged up to three days late

type Body = { kind?: string; listId?: string; taskId?: string; calendarId?: string; eventId?: string };

export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const row = await getIntegration(uid, "google");
  if (!row) return NextResponse.json({ error: "Connect Google first." }, { status: 400 });
  const token = await freshAccessToken(uid);
  if (!token) return NextResponse.json({ error: "Your Google connection expired. Reconnect it in your profile." }, { status: 400 });

  const issues: ApiIssue[] = [];

  if (body.kind === "task" && body.listId && body.taskId) {
    if (!canWriteTasks(row.scope)) {
      return NextResponse.json(
        { error: "Reconnect Google in your profile to tick tasks from here.", reconnect: true },
        { status: 400 },
      );
    }
    const task = await getTask(token, body.listId, body.taskId, issues);
    if (!task) return NextResponse.json({ error: explainIssues(issues) ?? "Task not found." }, { status: 404 });
    if (task.status !== "completed") {
      const ok = await completeTask(token, body.listId, body.taskId, issues);
      if (!ok) return NextResponse.json({ error: explainIssues(issues) ?? "Google would not update the task." }, { status: 502 });
    }
    const r = await payTask(uid, task);
    return NextResponse.json({ ok: true, paid: r.paid, xp: r.paid ? r.xp : 0, reason: r.reason });
  }

  if (body.kind === "event" && body.calendarId && body.eventId) {
    if (isCannedCalendar(body.calendarId)) {
      return NextResponse.json({ error: "Holidays and birthdays don't earn XP." }, { status: 400 });
    }
    const event = await getEvent(token, body.calendarId, body.eventId, issues);
    if (!event) return NextResponse.json({ error: explainIssues(issues) ?? "Event not found." }, { status: 404 });
    if ((event as { status?: string }).status === "cancelled") {
      return NextResponse.json({ error: "That event was cancelled." }, { status: 400 });
    }
    const start = eventStart(event);
    const now = Date.now();
    if (!Number.isFinite(start) || start > now) {
      return NextResponse.json({ error: "You can mark it done once it has started." }, { status: 400 });
    }
    if (now - start > GRACE_MS) {
      return NextResponse.json({ error: "Too long ago to log." }, { status: 400 });
    }
    const r = await payEvent(uid, event);
    return NextResponse.json({ ok: true, paid: r.paid, xp: r.paid ? r.xp : 0, reason: r.reason });
  }

  return NextResponse.json({ error: "invalid body" }, { status: 400 });
}
