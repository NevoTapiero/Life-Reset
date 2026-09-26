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

// icon names for the Icon component
export const PILLAR_ICONS: Record<Pillar, string> = {
  Body: "dumbbell",
  Mind: "bulb",
  Rest: "moon",
  Fuel: "leaf",
  Connection: "users",
  Purpose: "flame",
};

export type Stats = Record<StatKey, number>;

// ---------- characters ----------

export type CharacterKey = "warrior" | "mentalist" | "wizard" | "guardian" | "shadow";

export const CHARACTER_KEYS: CharacterKey[] = ["warrior", "mentalist", "wizard", "guardian", "shadow"];

export const CHARACTERS: Record<CharacterKey, { name: string; focus: string; stat: StatKey; accent: string }> = {
  warrior: { name: "The Warrior", focus: "Physical strength", stat: "STR", accent: "#ff6b00" },
  mentalist: { name: "The Mentalist", focus: "Mindfulness and calm focus", stat: "FOC", accent: "#a78bfa" },
  wizard: { name: "The Wizard", focus: "Wisdom and learning", stat: "WIS", accent: "#5aa7ff" },
  guardian: { name: "The Guardian", focus: "Vitality and endurance", stat: "CON", accent: "#34d399" },
  shadow: { name: "The Shadow", focus: "Discipline and consistency", stat: "DIS", accent: "#22d3ee" },
};

export function characterOf(key: string | null): (typeof CHARACTERS)[CharacterKey] | null {
  if (key && key in CHARACTERS) return CHARACTERS[key as CharacterKey];
  return null;
}

export type Profile = {
  id: string;
  username: string;
  archetype: CharacterKey | null;
  friend_code: string | null;
  share_activity: boolean;
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

// ---------- ranks: 6 tiers x 3 stages, ascending, rising XP cost ----------

export const TIERS = [
  { name: "Bronze", color: "#c9885a", divXp: 100 },
  { name: "Silver", color: "#c3cede", divXp: 150 },
  { name: "Gold", color: "#f5c752", divXp: 225 },
  { name: "Platinum", color: "#7fe3e0", divXp: 325 },
  { name: "Diamond", color: "#8ea2ff", divXp: 450 },
  { name: "Champion", color: "#ff4655", divXp: 600 },
] as const;

export const STAGES = ["I", "II", "III"] as const;

export type Rank = {
  tierIndex: number;
  stageIndex: number;
  tier: string;
  stage: string;
  label: string;
  color: string;
  xpIntoStage: number;
  xpForStage: number;
  progress: number;
  atMax: boolean;
};

export function rankForXp(xp: number): Rank {
  let remaining = Math.max(0, xp);
  for (let t = 0; t < TIERS.length; t++) {
    for (let s = 0; s < STAGES.length; s++) {
      const cost = TIERS[t].divXp;
      const last = t === TIERS.length - 1 && s === STAGES.length - 1;
      if (remaining < cost || last) {
        return {
          tierIndex: t,
          stageIndex: s,
          tier: TIERS[t].name,
          stage: STAGES[s],
          label: `${TIERS[t].name} ${STAGES[s]}`,
          color: TIERS[t].color,
          xpIntoStage: Math.min(remaining, cost),
          xpForStage: cost,
          progress: last && remaining >= cost ? 1 : remaining / cost,
          atMax: last && remaining >= cost,
        };
      }
      remaining -= cost;
    }
  }
  // unreachable, but keeps TypeScript satisfied
  return rankForXp(0);
}

// ---------- streak milestones (the bar counts up toward the next one) ----------

export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 365];

export function nextStreakMilestone(streak: number): number {
  for (const m of STREAK_MILESTONES) if (streak < m) return m;
  return STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
