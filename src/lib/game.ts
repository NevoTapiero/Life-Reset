export type StatKey = "CON" | "FOC" | "DIS" | "STR" | "WIS";

export const STAT_KEYS: StatKey[] = ["CON", "FOC", "DIS", "STR", "WIS"];

export const STAT_INFO: Record<StatKey, { name: string; blurb: string }> = {
  CON: { name: "Constitution", blurb: "Energy, health and recovery" },
  FOC: { name: "Focus", blurb: "Attention and deep work" },
  DIS: { name: "Discipline", blurb: "Consistency under low motivation" },
  STR: { name: "Strength", blurb: "Physical capability" },
  WIS: { name: "Wisdom", blurb: "Clarity, learning and perspective" },
};

export const PILLARS = ["Body", "Mind", "Rest", "Fuel", "Connection", "Purpose"] as const;
export type Pillar = (typeof PILLARS)[number];

// icon names for the Icon component, per the original app's pillar glyphs
export const PILLAR_ICONS: Record<Pillar, string> = {
  Body: "dumbbell",
  Mind: "bulb",
  Rest: "moon",
  Fuel: "leaf",
  Connection: "users",
  Purpose: "flame",
};

export type Stats = Record<StatKey, number>;

export type Profile = {
  id: string;
  username: string;
  archetype: string | null;
  focus_areas: string[];
  intensity: string | null;
  onboarding: Record<string, unknown>;
  onboarding_completed_at: string | null;
  plan_started_on: string | null;
  streak_commitment: number;
  xp: number;
  streak_current: number;
  streak_best: number;
  last_completed_on: string | null;
  stats: Stats;
  created_at: string;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  pillar: Pillar;
  xp: number;
  stats: StatKey[];
  icon: string;
  benefits: string[];
  sort: number;
  user_id: string | null;
};

const TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"] as const;
const DIVISIONS = ["V", "IV", "III", "II", "I"] as const;
export const DIVISION_XP = 150;

export const TIER_COLORS: Record<string, string> = {
  Bronze: "#c9885a",
  Silver: "#b9c4d6",
  Gold: "#f5c752",
  Platinum: "#7fe3e0",
  Diamond: "#8ea2ff",
};

export function rankForXp(xp: number) {
  const maxIdx = TIERS.length * DIVISIONS.length - 1;
  const idx = Math.min(Math.floor(Math.max(0, xp) / DIVISION_XP), maxIdx);
  const tier = TIERS[Math.floor(idx / DIVISIONS.length)];
  const division = DIVISIONS[idx % DIVISIONS.length];
  const atMax = idx === maxIdx;
  const into = Math.max(0, xp) - idx * DIVISION_XP;
  return {
    tier,
    division,
    label: `${tier} ${division}`,
    color: TIER_COLORS[tier],
    progress: atMax ? 1 : into / DIVISION_XP,
    xpIntoDivision: into,
    xpForDivision: DIVISION_XP,
    atMax,
  };
}

export const PLAN_DAYS = 66;

export function dayOfPlan(planStartedOn: string | null, todayIso: string): number {
  if (!planStartedOn) return 1;
  const start = new Date(planStartedOn + "T00:00:00Z").getTime();
  const today = new Date(todayIso + "T00:00:00Z").getTime();
  const diff = Math.round((today - start) / 86400000) + 1;
  return Math.min(Math.max(diff, 1), PLAN_DAYS);
}

export function finishDate(planStartedOn: string | null): Date {
  const start = planStartedOn ? new Date(planStartedOn + "T00:00:00Z") : new Date();
  const d = new Date(start.getTime() + (PLAN_DAYS - 1) * 86400000);
  return d;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

