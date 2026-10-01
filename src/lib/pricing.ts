// One price per activity, whatever reports it. A watch (Google Health, WHOOP)
// and a hand-checked quest must pay the same for the same thing: 10,000 steps
// was 10 XP from the watch and 14 from the Judge. Everything here returns a
// RATED value on the quest scale (the Judge's 1-50); the payout is then the
// same 7-day card as any quest: rated x 0.6 on day 1, up to x2.5 on day 7.
//
// Both src/lib/integrations/sync.ts (the watch) and /api/rate-quest (the Judge)
// price steps and sleep only through these functions.

export type TrackedKind = "steps" | "sleep" | "workout";

export const RATED_CAP = 50;

// Steps: 1 rated per 500, so 10,000 steps = 20.
export function stepsRated(steps: number): number {
  if (!Number.isFinite(steps) || steps < 500) return 0;
  return Math.min(RATED_CAP, Math.round(steps / 500));
}

// Sleep: the 7 to 9 hour band is "Sleep 7 to 9 hours" (12). Close to it pays
// less; a short night (5 to 6 hours) still pays a little, under 5 nothing.
export function sleepRated(hours: number): number {
  if (!Number.isFinite(hours) || hours < 5) return 0;
  if (hours < 6) return 4;
  if (hours >= 7 && hours <= 9) return 12;
  return 8;
}

// Workouts: the heart-rate intensity score is already on the quest scale.
export function workoutRated(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(RATED_CAP, Math.round(score)));
}

// A walk without a step count: about 110 steps a minute.
const STEPS_PER_MINUTE = 110;

function numberFrom(text: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(k)?\b/i.exec(text.replace(/(\d),(\d{3})/g, "$1$2"));
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return m[2] ? n * 1000 : n;
}

// The rated value of a hand-made quest for something a watch measures, read
// from its title, or null when the title gives nothing to go on (then the Judge
// rates it, told how the watch prices it).
export function ratedFromTitle(kind: TrackedKind, title: string): number | null {
  const t = title.toLowerCase();
  if (kind === "steps") {
    const minutes = /(\d+)\s*(min|minutes|mins|דקות|דק)/i.exec(t);
    if (minutes && /walk|הליכה|ללכת/i.test(t)) return Math.max(1, stepsRated(Number(minutes[1]) * STEPS_PER_MINUTE));
    const n = numberFrom(t);
    return n !== null && n >= 500 ? Math.max(1, stepsRated(n)) : null;
  }
  if (kind === "sleep") {
    // "7 to 9 hours", "7-9 hours", "8 hours": the lowest hour named is the goal
    const hours = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map((x) => Number(x[1])).filter((h) => h >= 3 && h <= 12);
    if (hours.length === 0) return 12; // "sleep well" means the standard night
    return sleepRated(Math.min(...hours)) || null;
  }
  return null; // workouts: the Judge rates them, anchored to the watch's scale
}

export const WORKOUT_PRICING_NOTE =
  "Workouts are priced like a watch prices them, from effort, time and calories together, 50 at most. A 60 minute strength session is about 30; a hard 30 minute run is about 35; an easy 30 minute run about 20; 30 minutes of stretching or yoga about 12; a 15 minute stretch about 6.";
