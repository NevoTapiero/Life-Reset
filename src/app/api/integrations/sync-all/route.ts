import { NextResponse } from "next/server";
import { userFromBearer } from "@/lib/integrations/server";
import { syncGoogle, syncWhoop } from "@/lib/integrations/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// Refresh every service the user has connected in one call. Safe to hit on app
// open: awarding is idempotent, so re-running never double counts.
export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const [google, whoop] = await Promise.all([syncGoogle(uid), syncWhoop(uid)]);
  return NextResponse.json({
    connectedAny: google.connected || whoop.connected,
    xpGained: google.xpGained + whoop.xpGained,
    newItems: google.newTasks + google.newEvents + whoop.newItems,
    google,
    whoop,
  });
}
