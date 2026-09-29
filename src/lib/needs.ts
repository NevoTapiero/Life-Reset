import type { Quest, StatKey } from "./game";

// The character is a mirror of your day. Five needs, one per stat, that sink
// as the day goes on and rise when you actually do something. Everything here
// is derived from data Today already has loaded, so the room reacts instantly.

export const NEED_KEYS: StatKey[] = ["CON", "STR", "FOC", "WIS", "DIS"];
export const NEED_LABEL: Record<StatKey, string> = {
  CON: "Energy",
  STR: "Body",
  FOC: "Focus",
  WIS: "Mind",
  DIS: "Discipline",
};
export type Needs = Record<StatKey, number>;
export type StatKeyNeed = StatKey;

// ponytail: linear drain of 2/hour from a 60 baseline, +25 per quest cleared
// today, +8 carry-over per quest cleared yesterday. Replace with real decay
// (and sleep data feeding Energy) once the feeling is right.
export function computeNeeds(
  quests: Quest[],
  doneToday: Set<string>,
  doneYesterday: Set<string>,
  hour: number,
  collected: { stat: StatKey; xp: number }[] = [], // bubbles you tapped: 1 XP = 1 point of that need
): Needs {
  const n = {} as Needs;
  for (const k of NEED_KEYS) n[k] = 60 - hour * 2;
  for (const q of quests) {
    const gain = doneToday.has(q.id) ? 25 : doneYesterday.has(q.id) ? 8 : 0;
    for (const k of q.stats) if (k in n) n[k] += gain;
  }
  for (const c of collected) if (c.stat in n) n[c.stat] += c.xp;
  for (const k of NEED_KEYS) n[k] = Math.max(5, Math.min(100, Math.round(n[k])));
  return n;
}

export function moodOf(n: Needs): { score: number; label: string; low: boolean } {
  const score = Math.round(NEED_KEYS.reduce((a, k) => a + n[k], 0) / NEED_KEYS.length);
  const label = score < 30 ? "Exhausted" : score < 50 ? "Running low" : score < 70 ? "Okay" : score < 85 ? "Good" : "Thriving";
  return { score, label, low: score < 50 };
}

// Where he stands in the room and what he is doing.
export type Spot = "bed" | "couch" | "mat" | "desk" | "kitchen";
export type Action = { label: string; spot: Spot };

const RULES: [RegExp, Action][] = [
  [/sleep/, { label: "Sleeping", spot: "bed" }],
  [/read|book|learn|course/, { label: "Reading", spot: "desk" }],
  [/water|hydrat/, { label: "Drinking water", spot: "kitchen" }],
  [/meal|eat|cook|protein/, { label: "Eating clean", spot: "kitchen" }],
  [/train|workout|gym|run|lift|walk|step/, { label: "Training", spot: "mat" }],
  [/cold/, { label: "Cold shower", spot: "mat" }],
  [/sun/, { label: "Getting sunlight", spot: "mat" }],
  [/deep work|focus|study/, { label: "Deep work", spot: "desk" }],
  [/plan|tomorrow|journal|write/, { label: "Planning tomorrow", spot: "desk" }],
  [/meditat|breath|gratitude|pray/, { label: "Meditating", spot: "couch" }],
  [/social|phone|scroll|screen/, { label: "Phone face down", spot: "couch" }],
  [/call|friend|family|reach/, { label: "Calling someone", spot: "couch" }],
];

const BY_PILLAR: Record<string, Action> = {
  Strength: { label: "Training", spot: "mat" },
  Focus: { label: "Focusing", spot: "desk" },
  Constitution: { label: "Recovering", spot: "bed" },
  Discipline: { label: "Holding the line", spot: "couch" },
  Wisdom: { label: "Learning", spot: "desk" },
};

export function actionFor(q: Pick<Quest, "id" | "title" | "pillar">): Action {
  const hay = `${q.id} ${q.title}`.toLowerCase();
  for (const [re, a] of RULES) if (re.test(hay)) return a;
  return BY_PILLAR[q.pillar] ?? { label: "Busy", spot: "mat" };
}

export function idleFor(n: Needs, hour?: number): Action {
  if (hour !== undefined && (hour >= 23 || hour < 6)) return { label: "Asleep", spot: "bed" };
  if (n.CON < 30) return { label: "Tired", spot: "couch" };
  if (moodOf(n).score >= 85) return { label: "Feeling great", spot: "mat" };
  return { label: "Idle", spot: "couch" };
}

// Real time, app timezone. The world runs on your clock.
export function appHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(now));
}

// How dark the world is right now: 0 by day, up to 1 deep at night.
export function nightAmount(hour: number): number {
  if (hour >= 7 && hour < 18) return 0;
  if (hour >= 18 && hour < 21) return (hour - 18) / 3; // dusk
  if (hour >= 5 && hour < 7) return (7 - hour) / 2; // dawn
  return 1;
}
