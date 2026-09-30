// Energy: how much running and jumping you have in you today, from how you
// slept last night and how much you've moved today (the watch's sleep and
// steps rows in the ledger, priced in src/lib/pricing.ts). 0..100.
//
//   sleep   7-9 h (rated 12) → 60   6-7 h (rated 8) → 35   under 6 h (0) → 10
//           no sleep row at all (no watch, or not synced yet) → 45: the benefit of the doubt
//   steps   2 a rated point (1 per 500 steps), up to 40: 10,000 steps fills it
//
// Running costs energy, a jump costs a little; it trickles back slowly while
// you take it easy, and fills again with the next night's sleep.
export type LedgerMeta = { kind?: string; rated?: number; day?: string };

export const ENERGY_MAX = 100;
export const RUN_COST = 2.5; // a second of running
export const JUMP_COST = 5;
export const TRICKLE = 0.12; // a second, resting
export const CAN_RUN_AT = 5; // below this you walk

/** energy from the ledger's meta rows; `today` as YYYY-MM-DD */
export function energyFrom(rows: LedgerMeta[], today: string): number {
  const yesterday = shift(today, -1);
  // last night's sleep is filed on today or yesterday (whichever the sync used); take the latest
  const sleep = rows.filter((r) => r.kind === "sleep" && (r.day === today || r.day === yesterday)).sort((a, b) => (a.day! < b.day! ? 1 : -1))[0];
  const rested = sleep === undefined ? 45 : (sleep.rated ?? 0) >= 12 ? 60 : (sleep.rated ?? 0) > 0 ? 35 : 10;
  const steps = rows.filter((r) => r.kind === "steps" && r.day === today).reduce((a, r) => a + (r.rated ?? 0), 0);
  return Math.min(ENERGY_MAX, rested + Math.min(40, steps * 2));
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function shift(day: string, by: number) {
  const [y, m, d] = day.split("-").map(Number);
  return todayKey(new Date(y, m - 1, d + by));
}
