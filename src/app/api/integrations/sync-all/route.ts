import { NextResponse } from "next/server";
import { userFromBearer } from "@/lib/integrations/server";
import { syncGoogle, syncHealth, syncWhoop } from "@/lib/integrations/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// Refresh every service the user has connected in one call. Safe to hit on app
// open: awarding is idempotent, so re-running never double counts.
export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const [google, whoop, health] = await Promise.all([syncGoogle(uid), syncWhoop(uid), syncHealth(uid)]);
  return NextResponse.json({
    connectedAny: google.connected || whoop.connected || health.connected,
    xpGained: google.xpGained + whoop.xpGained + health.xpGained,
    newItems: google.newTasks + google.newEvents + whoop.newItems + health.newItems,
    google,
    whoop,
    health,
  });
}
