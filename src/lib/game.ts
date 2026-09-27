export type StatKey = "CON" | "FOC" | "DIS" | "STR" | "WIS";

export const STAT_KEYS: StatKey[] = ["CON", "FOC", "DIS", "STR", "WIS"];

export const STAT_INFO: Record<StatKey, { name: string; blurb: string; lore: string }> = {
  CON: {
    name: "Constitution",
    blurb: "Energy, health and recovery",
    lore: "Your body's engine: how much energy you have and how fast you recover. It grows +2 every time you clear a quest that feeds it, like drinking water, sleeping well, sunlight or a clean meal.",
  },
  FOC: {
    name: "Focus",
    blurb: "Attention and deep work",
    lore: "Your ability to point attention at one thing and keep it there. Trained by deep work blocks, good sleep, meditation and staying off the scroll.",
  },
  DIS: {
    name: "Discipline",
    blurb: "Consistency under low motivation",
    lore: "Doing it anyway on the days you do not feel like it. Trained by cold showers, screen limits, planning tomorrow and any streak you refuse to break.",
  },
  STR: {
    name: "Strength",
    blurb: "Physical capability",
    lore: "Raw physical capability: muscle, stamina, capacity. Trained by workouts, hydration and fueling your body properly.",
  },
  WIS: {
    name: "Wisdom",
    blurb: "Clarity, learning and perspective",
    lore: "Perspective and learning: understanding yourself and the world a little better each day. Trained by reading, journaling, gratitude, learning and reaching out to people.",
  },
};

// quest categories are the five stats: every quest feeds exactly one
export const PILLARS = ["Strength", "Focus", "Constitution", "Discipline", "Wisdom"] as const;
export type Pillar = (typeof PILLARS)[number];

export const PILLAR_STAT: Record<Pillar, StatKey> = {
  Strength: "STR",
  Focus: "FOC",
  Constitution: "CON",
  Discipline: "DIS",
  Wisdom: "WIS",
};

// icon names for the Icon component — one signature icon per stat, used app-wide
export const STAT_ICONS: Record<StatKey, string> = {
  STR: "stat-str",
  FOC: "stat-foc",
  CON: "stat-con",
  DIS: "stat-dis",
  WIS: "stat-wis",
};

export const PILLAR_ICONS: Record<Pillar, string> = {
  Strength: "stat-str",
  Focus: "stat-foc",
  Constitution: "stat-con",
  Discipline: "stat-dis",
  Wisdom: "stat-wis",
};

export type Stats = Record<StatKey, number>;

// ---------- characters ----------

export type CharacterKey = "warrior" | "mentalist" | "wizard" | "guardian" | "shadow";

export const CHARACTER_KEYS: CharacterKey[] = ["warrior", "mentalist", "wizard", "guardian", "shadow"];

export const CHARACTERS: Record<
  CharacterKey,
  { name: string; focus: string; stat: StatKey; accent: string; accent2: string }
> = {
  warrior: { name: "The Warrior", focus: "Physical strength", stat: "STR", accent: "#ff6b00", accent2: "#ffb45c" },
  mentalist: { name: "The Mentalist", focus: "Mindfulness and calm focus", stat: "FOC", accent: "#a78bfa", accent2: "#d8ccff" },
  wizard: { name: "The Wizard", focus: "Wisdom and learning", stat: "WIS", accent: "#5aa7ff", accent2: "#9fd2ff" },
  guardian: { name: "The Guardian", focus: "Vitality and endurance", stat: "CON", accent: "#34d399", accent2: "#8df0c6" },
  shadow: { name: "The Shadow", focus: "Discipline and consistency", stat: "DIS", accent: "#22d3ee", accent2: "#7ceafa" },
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

// milestones climb in jumps of 7: reach 7 and the bar becomes 7/14, then 14/21…
export function nextStreakMilestone(streak: number): number {
  return (Math.floor(Math.max(0, streak) / 7) + 1) * 7;
}

// full-bleed card art, one scene per category (legacy pillar names still map)
export function questArt(pillar: Pillar | string): string {
  const scenes: Record<string, string> = {
    strength: "body",
    focus: "mind",
    constitution: "rest",
    discipline: "purpose",
    wisdom: "connection",
    body: "body",
    mind: "mind",
    rest: "rest",
    fuel: "fuel",
    connection: "connection",
    purpose: "purpose",
  };
  return `/art/pillar-${scenes[String(pillar).toLowerCase()] ?? "purpose"}.svg`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
