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

// ---------- character skins: a new outfit unlocks at each rank tier ----------
// Tier art lives at /chars/{key}-t{tier}.webp (tier 0 = the base /chars/{key}.webp).
// As the art for each character is produced, add its tier numbers here; the
// avatar always shows the highest unlocked skin at or below the player's tier.
export const CHARACTER_SKIN_TIERS: Record<CharacterKey, number[]> = {
  warrior: [0, 5],
  mentalist: [0],
  wizard: [0],
  guardian: [0],
  shadow: [0],
};

// The skin tier the player currently wears, given their rank tier.
export function skinTierFor(key: CharacterKey, tierIndex: number | undefined): number {
  const tiers = CHARACTER_SKIN_TIERS[key] ?? [0];
  let best = 0;
  if (typeof tierIndex === "number") for (const t of tiers) if (t <= tierIndex) best = t;
  return best;
}

// Portrait URL for a character at a given rank tier (falls back to the base art).
export function avatarSrc(key: CharacterKey, tierIndex?: number): string {
  const skin = skinTierFor(key, tierIndex);
  return skin > 0 ? `/chars/${key}-t${skin}.webp` : `/chars/${key}.webp`;
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
  period?: Period; // missing on rows cached before 30.9: treat as daily
  tracks?: TrackedKind | null;
};

// ---------- quest periods: daily, weekly, monthly ----------
// Mirrors public.period_start / period_index in the database. Weeks run Sunday
// to Saturday. A weekly or monthly quest is checked once per period and its
// 7-step card counts periods in a row.
export type Period = "daily" | "weekly" | "monthly";
export const PERIODS: Period[] = ["daily", "weekly", "monthly"];
export const PERIOD_LABEL: Record<Period, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
export const PERIOD_UNIT: Record<Period, string> = { daily: "Day", weekly: "Week", monthly: "Month" };
export const PERIOD_XP_CAP: Record<Period, number> = { daily: 60, weekly: 100, monthly: 200 };

export function periodOf(q: Pick<Quest, "period">): Period {
  return q.period ?? "daily";
}

// First day (YYYY-MM-DD) of the period containing `ymd`.
export function periodStart(period: Period, ymd: string): string {
  if (period === "daily") return ymd;
  const d = new Date(ymd + "T00:00:00Z");
  if (period === "weekly") return shiftDay(ymd, -d.getUTCDay());
  return ymd.slice(0, 8) + "01";
}

function prevPeriodStart(period: Period, start: string): string {
  if (period === "daily") return shiftDay(start, -1);
  if (period === "weekly") return shiftDay(start, -7);
  return periodStart("monthly", shiftDay(start, -1));
}

// Whether any date in `dates` falls in the period containing `ymd`.
export function doneInPeriod(dates: Set<string>, period: Period, ymd: string): boolean {
  const start = periodStart(period, ymd);
  for (const d of dates) if (periodStart(period, d) === start) return true;
  return false;
}

// The card step a check in the period containing `on` counts as, for any period.
export function cardStepOn(dates: Set<string>, period: Period, on: string): number {
  if (period === "daily") return cardDayOn(dates, on);
  const starts = new Set([...dates].map((d) => periodStart(period, d)));
  let run = 0;
  for (let p = prevPeriodStart(period, periodStart(period, on)); starts.has(p); p = prevPeriodStart(period, p)) run++;
  return (run % CARD_DAYS) + 1;
}

// ---------- quests a connected watch already pays for ----------
// Mirrors public.tracked_by(): these can't be checked by hand while connected.
export type TrackedKind = "steps" | "sleep" | "workout";
const TRACKERS: Record<TrackedKind, string[]> = {
  steps: ["ghealth"],
  sleep: ["ghealth", "whoop"],
  workout: ["ghealth", "whoop"],
};
export const TRACKER_NAME: Record<string, string> = { ghealth: "Google Health", whoop: "WHOOP" };

// The connection that pays for this quest automatically, or null.
export function trackedBy(q: Pick<Quest, "tracks">, providers: string[]): string | null {
  if (!q.tracks) return null;
  return TRACKERS[q.tracks].find((p) => providers.includes(p)) ?? null;
}

// ---------- ranks: 6 tiers x 3 stages, ascending, rising XP cost ----------
// Costs doubled on 30.9 (players reached Silver II on day three).

export const TIERS = [
  { name: "Bronze", color: "#c9885a", divXp: 200 },
  { name: "Silver", color: "#c3cede", divXp: 300 },
  { name: "Gold", color: "#f5c752", divXp: 450 },
  { name: "Platinum", color: "#7fe3e0", divXp: 650 },
  { name: "Diamond", color: "#8ea2ff", divXp: 900 },
  { name: "Champion", color: "#ff4655", divXp: 1200 },
] as const;

// ---------- 7-day cards: XP rewards consistency, not single actions ----------
// Every quest runs its own 7-day card. Each consecutive day the quest pays more,
// day 7 pays x2.5, then the card starts again at day 1. Missing a day also
// sends it back to day 1. Mirrored exactly by public.card_xp() in the database,
// which is what actually pays; these helpers only preview it.

// Kept in whole percents: 10 x 1.15 is 11.4999... in floating point but 11.5 in
// Postgres numeric, which would make the preview disagree with the payout.
export const QUEST_XP_PCT = 60; // a quest's rated value (1-60) -> its day-1 payout
export const CARD_DAYS = 7;
export const CARD_MULT_PCT = [100, 115, 130, 150, 175, 200, 250] as const;
// Every 7th day of the streak (days with at least one quest done) pays this on top.
export const STREAK_BONUS_XP = 50;

export function questBase(rated: number): number {
  return Math.max(1, Math.round((rated * QUEST_XP_PCT) / 100));
}

export function cardXp(rated: number, day: number): number {
  const d = Math.min(CARD_DAYS, Math.max(1, day));
  return Math.max(1, Math.round((questBase(rated) * CARD_MULT_PCT[d - 1]) / 100));
}

function shiftDay(ymd: string, delta: number): string {
  return new Date(new Date(ymd + "T00:00:00Z").getTime() + delta * 86400000).toISOString().slice(0, 10);
}

// The card day a completion on `on` counts as: one past the unbroken run of
// completions ending the day before, wrapping back to 1 after day 7.
export function cardDayOn(doneDates: Set<string>, on: string): number {
  let run = 0;
  for (let d = shiftDay(on, -1); doneDates.has(d); d = shiftDay(d, -1)) run++;
  return (run % CARD_DAYS) + 1;
}

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

// full-bleed card art: one painted scene per category (legacy pillar names still map)
export function questArt(pillar: Pillar | string): string {
  const scenes: Record<string, string> = {
    strength: "str",
    focus: "foc",
    constitution: "con",
    discipline: "dis",
    wisdom: "wis",
    body: "str",
    mind: "foc",
    rest: "con",
    fuel: "con",
    connection: "wis",
    purpose: "dis",
  };
  return `/art/cat-${scenes[String(pillar).toLowerCase()] ?? "dis"}.webp`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
