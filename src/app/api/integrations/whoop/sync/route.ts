import { NextResponse } from "next/server";
import { userFromBearer, getIntegration, touchSync, awardXp } from "@/lib/integrations/server";
import { freshAccessToken, recentSleep, recentRecovery, recentWorkouts } from "@/lib/integrations/whoop";

export const runtime = "nodejs";
export const maxDuration = 60;

// Turn WHOOP's objective scores into XP: sleep performance %, recovery %, and
// workout strain (0-21). Idempotent per record via the xp_ledger.
export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const row = await getIntegration(uid, "whoop");
  if (!row) return NextResponse.json({ connected: false });

  const token = await freshAccessToken(uid);
  if (!token) return NextResponse.json({ connected: false, error: "reconnect" });

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
  let counted = 0;

  const grant = async (source: string, ref: string, xp: number, reason: string) => {
    if (xp <= 0) return;
    if (await awardXp(uid, source, ref, xp, reason)) {
      xpGained += xp;
      counted++;
    }
  };

  for (const s of sleeps) {
    if (s.nap || s.score_state !== "SCORED") continue;
    const perf = s.score?.sleep_performance_percentage ?? 0;
    await grant("whoop_sleep", `sleep:${s.id}`, Math.round(perf / 5), "WHOOP sleep performance");
  }
  for (const r of recoveries) {
    if (r.score_state !== "SCORED") continue;
    const score = r.score?.recovery_score ?? 0;
    await grant("whoop_recovery", `recovery:${r.cycle_id}`, Math.round(score / 5), "WHOOP recovery");
  }
  for (const w of workouts) {
    if (w.score_state !== "SCORED") continue;
    const strain = w.score?.strain ?? 0;
    await grant("whoop_workout", `workout:${w.id}`, Math.round(strain * 2), `WHOOP workout: ${w.sport_name ?? "activity"}`);
  }

  await touchSync(uid, "whoop");
  return NextResponse.json({ connected: true, newItems: counted, xpGained });
}
