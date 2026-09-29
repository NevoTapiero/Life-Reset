import { NextResponse } from "next/server";
import { userFromBearer, getIntegration } from "@/lib/integrations/server";
import {
  ApiIssue,
  eventsEverywhere,
  explainIssues,
  freshAccessToken,
  localDayRange,
  openTasks,
} from "@/lib/integrations/google";

export const runtime = "nodejs";
export const maxDuration = 60;

// The player's real schedule and open tasks, read live. Nothing is awarded here:
// this exists so the app can show what it is tracking instead of only the XP.

export async function GET(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const row = await getIntegration(uid, "google");
  if (!row) return NextResponse.json({ connected: false, events: [], tasks: [] });
  const token = await freshAccessToken(uid);
  if (!token) return NextResponse.json({ connected: false, reconnect: true, events: [], tasks: [] });

  const { start, end } = localDayRange(7);
  const issues: ApiIssue[] = [];
  const [events, tasks] = await Promise.all([
    eventsEverywhere(token, start.toISOString(), end.toISOString(), issues),
    openTasks(token, issues),
  ]);

  const todayEnd = start.getTime() + 86400_000;
  return NextResponse.json({
    connected: true,
    problem: explainIssues(issues),
    events: events.slice(0, 25).map((e) => {
      const iso = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00` : null);
      const at = iso ? new Date(iso).getTime() : 0;
      return {
        id: e.id,
        title: (e.summary ?? "Busy").slice(0, 90),
        start: iso,
        allDay: !e.start?.dateTime,
        today: at >= start.getTime() && at < todayEnd,
      };
    }),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title.slice(0, 90), due: t.due ?? null })),
  });
}
