import { STAT_KEYS, Stats, StatKey } from "./game";

export type Answers = Record<string, string | string[] | number | undefined>;

export type ChoiceOption = { value: string; label: string; desc?: string; emoji?: string };

export type QuizStep =
  | {
      kind: "choice";
      key: string;
      question: string;
      sub?: string;
      options: ChoiceOption[];
      when?: (a: Answers) => boolean;
    }
  | {
      kind: "multi";
      key: string;
      question: string;
      sub?: string;
      options: ChoiceOption[];
      max: number;
      exclusiveValue?: string;
      when?: (a: Answers) => boolean;
    }
  | {
      kind: "slider";
      key: string;
      question: string;
      sub?: string;
      min: number;
      max: number;
      minLabel: string;
      maxLabel: string;
      when?: (a: Answers) => boolean;
    }
  | {
      kind: "info";
      key: string;
      screen:
        | "results"
        | "system"
        | "mechanics"
        | "science"
        | "questcards"
        | "community"
        | "notifications"
        | "boardPreview"
        | "generating"
        | "archetype"
        | "statsheet";
      when?: (a: Answers) => boolean;
    };

const hasFocus = (a: Answers, v: string) => Array.isArray(a.focus) && (a.focus as string[]).includes(v);

export const FOCUS_LABELS: Record<string, string> = {
  health: "Health & fitness",
  mental: "Mental health & wellbeing",
  career: "Career & productivity",
  discipline: "Discipline & habits",
  relationships: "Relationships & social life",
  education: "Education & learning",
  spiritual: "Spiritual growth & purpose",
  rebuild: "Life crisis & rebuilding",
};

export const QUIZ_STEPS: QuizStep[] = [
  {
    kind: "choice",
    key: "age",
    question: "How old are you?",
    options: [
      { value: "13-17", label: "13 to 17" },
      { value: "18-24", label: "18 to 24" },
      { value: "25-34", label: "25 to 34" },
      { value: "35-44", label: "35 to 44" },
      { value: "45-54", label: "45 to 54" },
      { value: "55+", label: "55 or above" },
    ],
  },
  {
    kind: "choice",
    key: "gender",
    question: "What is your gender?",
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "other", label: "Other" },
      { value: "na", label: "Prefer not to say" },
    ],
  },
  {
    kind: "choice",
    key: "source",
    question: "Where did you hear about Life Reset?",
    options: [
      { value: "instagram", label: "Instagram", emoji: "📸" },
      { value: "tiktok", label: "TikTok", emoji: "🎵" },
      { value: "youtube", label: "YouTube", emoji: "▶️" },
      { value: "friends", label: "Friends or family", emoji: "🗣️" },
      { value: "search", label: "Search", emoji: "🔎" },
      { value: "other", label: "Somewhere else", emoji: "🌐" },
    ],
  },
  {
    kind: "choice",
    key: "satisfaction",
    question: "How would you describe your current life?",
    options: [
      { value: "satisfied", label: "I am satisfied with my life now", emoji: "😌" },
      { value: "improve", label: "I am alright and want to self improve", emoji: "🙂" },
      { value: "okay", label: "I am doing okay, not good or bad", emoji: "😐" },
      { value: "sad", label: "I am sad and rarely happy", emoji: "😔" },
      { value: "lowest", label: "I am at my lowest and need help", emoji: "🆘" },
    ],
  },
  {
    kind: "multi",
    key: "focus",
    question: "What areas of your life need the most attention right now?",
    sub: "Pick up to 3, most important first.",
    max: 3,
    options: [
      { value: "health", label: "Health & fitness", emoji: "💪" },
      { value: "mental", label: "Mental health & wellbeing", emoji: "🧠" },
      { value: "career", label: "Career & productivity", emoji: "💼" },
      { value: "discipline", label: "Discipline & habits", emoji: "🔁" },
      { value: "relationships", label: "Relationships & social life", emoji: "🤝" },
      { value: "education", label: "Education & learning", emoji: "📚" },
      { value: "spiritual", label: "Spiritual growth & purpose", emoji: "🕊️" },
      { value: "rebuild", label: "Life crisis & rebuilding", emoji: "🌱" },
    ],
  },
  {
    kind: "choice",
    key: "health_goal",
    question: "What is your main health goal?",
    when: (a) => hasFocus(a, "health"),
    options: [
      { value: "lose", label: "Lose weight", emoji: "⚖️" },
      { value: "muscle", label: "Build muscle & strength", emoji: "🏋️" },
      { value: "fitter", label: "Get fitter overall", emoji: "🏃" },
      { value: "energy", label: "More energy & better sleep", emoji: "🔋" },
      { value: "confidence", label: "Look better & feel more confident", emoji: "✨" },
    ],
  },
  {
    kind: "choice",
    key: "health_obstacle",
    question: "What is the biggest thing stopping you?",
    when: (a) => hasFocus(a, "health"),
    options: [
      { value: "time", label: "No time" },
      { value: "motivation", label: "No motivation" },
      { value: "start", label: "I do not know how to start" },
      { value: "quit", label: "I always quit after a few days" },
      { value: "injury", label: "Injury or health issue" },
    ],
  },
  {
    kind: "multi",
    key: "injuries",
    question: "Does anything limit what your body can do right now?",
    sub: "We adapt your plan around it. Select all that apply.",
    max: 8,
    exclusiveValue: "none",
    when: (a) => hasFocus(a, "health"),
    options: [
      { value: "none", label: "Nothing limits me", emoji: "✅" },
      { value: "knee", label: "Knee injury or knee pain" },
      { value: "ankle", label: "Ankle or foot injury" },
      { value: "hip", label: "Hip or leg injury" },
      { value: "back", label: "Back problem" },
      { value: "shoulder", label: "Shoulder problem" },
      { value: "joints", label: "Joint pain or arthritis" },
      { value: "heart", label: "Heart or breathing condition" },
      { value: "postpartum", label: "Pregnancy or postpartum recovery" },
    ],
  },
  {
    kind: "choice",
    key: "injury_status",
    question: "How is it right now?",
    sub: "A new injury and an old one need different starting points.",
    when: (a) =>
      hasFocus(a, "health") &&
      Array.isArray(a.injuries) &&
      (a.injuries as string[]).length > 0 &&
      !(a.injuries as string[]).includes("none"),
    options: [
      { value: "new", label: "It is new or still painful" },
      { value: "healing", label: "It is healing but not back to normal" },
      { value: "managed", label: "It is a long term or managed issue" },
    ],
  },
  {
    kind: "choice",
    key: "career_stage",
    question: "Where are you in your career?",
    when: (a) => hasFocus(a, "career"),
    options: [
      { value: "student", label: "Student", emoji: "🎓" },
      { value: "early", label: "Early career", emoji: "🚀" },
      { value: "stuck", label: "Mid career and feeling stuck", emoji: "🧱" },
      { value: "founder", label: "Entrepreneur or freelancer", emoji: "🛠️" },
      { value: "between", label: "Between jobs", emoji: "🔍" },
    ],
  },
  {
    kind: "choice",
    key: "career_challenge",
    question: "What is your biggest career challenge?",
    when: (a) => hasFocus(a, "career"),
    options: [
      { value: "time", label: "Time management" },
      { value: "focus", label: "Focus & distraction" },
      { value: "procrastination", label: "Procrastination" },
      { value: "energy", label: "Low energy through the day" },
      { value: "balance", label: "Work-life balance" },
    ],
  },
  {
    kind: "choice",
    key: "attempts",
    question: "How many times have you tried to change this?",
    options: [
      { value: "first", label: "This is my first time" },
      { value: "1-2", label: "1 to 2 times" },
      { value: "3-5", label: "3 to 5 times" },
      { value: "lost-count", label: "I have lost count" },
    ],
  },
  {
    kind: "choice",
    key: "proud",
    question: "When is the last time you felt proud of yourself?",
    options: [
      { value: "today", label: "Just today" },
      { value: "days", label: "A few days ago" },
      { value: "weeks", label: "A few weeks ago" },
      { value: "months", label: "A few months ago" },
      { value: "long", label: "Too long, I cannot remember" },
    ],
  },
  {
    kind: "choice",
    key: "sleep",
    question: "How would you describe your sleep right now?",
    options: [
      { value: "great", label: "I sleep well and wake up refreshed", emoji: "😴" },
      { value: "okay", label: "It is okay but could be better", emoji: "🙂" },
      { value: "struggle", label: "I struggle with sleep regularly", emoji: "😵" },
      { value: "chaos", label: "My schedule is all over the place", emoji: "🌀" },
    ],
  },
  {
    kind: "choice",
    key: "eating",
    question: "How would you describe your eating habits?",
    options: [
      { value: "healthy", label: "I eat healthy most days", emoji: "🥗" },
      { value: "inconsistent", label: "I try but it is inconsistent", emoji: "⚖️" },
      { value: "convenience", label: "I mostly eat convenience food", emoji: "🍔" },
      { value: "ignore", label: "I barely think about nutrition", emoji: "🤷" },
    ],
  },
  {
    kind: "choice",
    key: "predictability",
    question: "How predictable are your days?",
    options: [
      { value: "routine", label: "Very predictable, same routine daily" },
      { value: "mostly", label: "Mostly predictable with some surprises" },
      { value: "weekly", label: "Changes week to week" },
      { value: "shifts", label: "Shift work or night schedule" },
      { value: "chaos", label: "Very chaotic right now" },
    ],
  },
  {
    kind: "choice",
    key: "discipline",
    question: "Which sounds most like you right now?",
    options: [
      { value: "struggle", label: "I struggle to start basic habits" },
      { value: "structure", label: "I can do basics, but I need structure" },
      { value: "disciplined", label: "I am already disciplined, I want a sharper system" },
      { value: "performance", label: "I want a high performance plan" },
    ],
  },
  {
    kind: "choice",
    key: "orientation",
    question: "Which feels more true to you?",
    options: [
      { value: "identity", label: "I want to become someone who lives with discipline", emoji: "🧭" },
      { value: "outcome", label: "I want to hit my goals and see real results", emoji: "🏁" },
    ],
  },
  {
    kind: "multi",
    key: "values",
    question: "What matters most to you right now?",
    sub: "Pick up to 3.",
    max: 3,
    options: [
      { value: "health-energy", label: "Health & energy", emoji: "⚡" },
      { value: "peace", label: "Peace of mind", emoji: "🕯️" },
      { value: "achievement", label: "Achievement & success", emoji: "🏆" },
      { value: "freedom", label: "Freedom & independence", emoji: "🕊️" },
      { value: "faith", label: "Faith & purpose", emoji: "✨" },
      { value: "connection", label: "Connection & belonging", emoji: "🫂" },
      { value: "growth", label: "Personal growth", emoji: "🌱" },
    ],
  },
  {
    kind: "slider",
    key: "confidence",
    question: "How confident are you that you can stick with a daily routine for 7 days?",
    sub: "Be honest, there is no wrong answer.",
    min: 1,
    max: 10,
    minLabel: "Not confident",
    maxLabel: "Very confident",
  },
  {
    kind: "choice",
    key: "challenge_style",
    question: "How do you like to be challenged?",
    options: [
      { value: "gentle", label: "Do not push me, I need gentle steps", emoji: "🌤️" },
      { value: "steady", label: "Steady growth, build up gradually", emoji: "📈" },
      { value: "push", label: "Push me, I can handle pressure", emoji: "🔥" },
      { value: "allin", label: "Go all in, I want maximum challenge", emoji: "⚔️" },
    ],
  },
  { kind: "info", key: "results", screen: "results" },
  { kind: "info", key: "system", screen: "system" },
  { kind: "info", key: "mechanics", screen: "mechanics" },
  { kind: "info", key: "science", screen: "science" },
  { kind: "info", key: "questcards", screen: "questcards" },
  { kind: "info", key: "community", screen: "community" },
  { kind: "info", key: "notifications", screen: "notifications" },
  { kind: "info", key: "boardPreview", screen: "boardPreview" },
  { kind: "info", key: "generating", screen: "generating" },
  { kind: "info", key: "archetype", screen: "archetype" },
  { kind: "info", key: "statsheet", screen: "statsheet" },
  {
    kind: "choice",
    key: "streak_commitment",
    question: "Commit to growing with Life Reset",
    sub: "The streak system carries you through the days motivation drops. Pick your first commitment.",
    options: [
      { value: "7", label: "7 day streak", desc: "A careful start" },
      { value: "14", label: "14 day streak", desc: "Recommended: long enough to carry you past the first dip" },
      { value: "30", label: "30 day streak", desc: "For the ambitious" },
      { value: "50", label: "50 day streak", desc: "Hard mode" },
    ],
  },
];

// ---------- scoring ----------

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function computeBaselineStats(a: Answers): Stats {
  const s: Stats = { CON: 50, FOC: 50, DIS: 50, STR: 50, WIS: 50 };

  const discipline = a.discipline as string;
  if (discipline === "struggle") s.DIS = 38;
  if (discipline === "structure") s.DIS = 46;
  if (discipline === "disciplined") s.DIS = 62;
  if (discipline === "performance") s.DIS = 66;
  if (a.attempts === "lost-count") s.DIS -= 4;
  if (a.attempts === "3-5") s.DIS -= 2;
  if (a.challenge_style === "allin") s.DIS += 4;
  if (a.challenge_style === "push") s.DIS += 2;
  const conf = typeof a.confidence === "number" ? a.confidence : 5;
  if (conf >= 8) s.DIS += 4;
  if (conf <= 3) s.DIS -= 4;

  if (a.career_challenge === "focus") s.FOC -= 6;
  if (a.career_challenge === "procrastination") s.FOC -= 4;
  if (a.predictability === "routine") s.FOC += 6;
  if (a.predictability === "chaos") s.FOC -= 6;
  if (a.predictability === "shifts") s.FOC -= 3;
  if (a.sleep === "struggle") s.FOC -= 4;

  if (a.sleep === "great") s.CON += 8;
  if (a.sleep === "struggle") s.CON -= 6;
  if (a.sleep === "chaos") s.CON -= 4;
  if (a.eating === "healthy") s.CON += 8;
  if (a.eating === "convenience") s.CON -= 6;
  if (a.eating === "ignore") s.CON -= 8;

  const injuries = Array.isArray(a.injuries) ? (a.injuries as string[]).filter((x) => x !== "none") : [];
  s.CON -= Math.min(injuries.length * 2, 8);
  s.STR -= Math.min(injuries.length * 3, 12);
  if (a.health_goal === "muscle") s.STR += 6;
  if (a.health_goal === "fitter") s.STR += 3;
  if (a.health_obstacle === "injury") s.STR -= 4;

  if (a.proud === "today") s.WIS += 6;
  if (a.proud === "months") s.WIS -= 3;
  if (a.proud === "long") s.WIS -= 6;
  const values = Array.isArray(a.values) ? (a.values as string[]) : [];
  if (values.includes("growth")) s.WIS += 4;
  if (values.includes("faith")) s.WIS += 3;
  if (values.includes("peace")) s.WIS += 2;

  for (const k of STAT_KEYS) s[k as StatKey] = clamp(Math.round(s[k as StatKey]), 32, 72);
  return s;
}

export type Archetype = { key: string; name: string; tagline: string; blurb: string };

export const ARCHETYPES: Record<string, Archetype> = {
  phoenix: {
    key: "phoenix",
    name: "The Phoenix",
    tagline: "Built from the ashes",
    blurb: "You are rebuilding from a hard place, and that is exactly where the strongest resets start. The Phoenix rises one kept promise at a time.",
  },
  disciplined: {
    key: "disciplined",
    name: "The Disciplined",
    tagline: "The engine is there, now build the track",
    blurb: "You already have the engine, you need the track. The Disciplined build systems that make consistency effortless.",
  },
  strategist: {
    key: "strategist",
    name: "The Strategist",
    tagline: "Clarity before force",
    blurb: "You win by designing the game, not by brute force. The Strategist turns scattered effort into compounding progress.",
  },
  warrior: {
    key: "warrior",
    name: "The Warrior",
    tagline: "Strength through repetition",
    blurb: "You respond to challenge and intensity. The Warrior grows through hard reps, cold mornings and kept commitments.",
  },
  seeker: {
    key: "seeker",
    name: "The Seeker",
    tagline: "Calm is a skill",
    blurb: "You are after clarity and peace of mind. The Seeker trains the inner game first, and the outer game follows.",
  },
  challenger: {
    key: "challenger",
    name: "The Challenger",
    tagline: "Ready for Campaign 1",
    blurb: "You are ready for a structured run at a better routine. The Challenger levels everything a little every day.",
  },
};

export function computeArchetype(a: Answers): Archetype {
  const focus = Array.isArray(a.focus) ? (a.focus as string[]) : [];
  if (a.satisfaction === "lowest" || focus.includes("rebuild")) return ARCHETYPES.phoenix;
  if (a.discipline === "disciplined" || a.discipline === "performance") return ARCHETYPES.disciplined;
  if (focus[0] === "career") return ARCHETYPES.strategist;
  if (focus[0] === "health" && (a.challenge_style === "push" || a.challenge_style === "allin")) return ARCHETYPES.warrior;
  if (focus[0] === "spiritual" || focus[0] === "mental") return ARCHETYPES.seeker;
  return ARCHETYPES.challenger;
}

export type OnboardingPayload = {
  version: number;
  answers: Answers;
  focus_areas: string[];
  intensity: string;
  archetype: string;
  archetype_key: string;
  baseline_stats: Stats;
  streak_commitment: number;
};

export function buildPayload(a: Answers): OnboardingPayload {
  const arch = computeArchetype(a);
  return {
    version: 1,
    answers: a,
    focus_areas: Array.isArray(a.focus) ? (a.focus as string[]) : [],
    intensity: (a.challenge_style as string) ?? "steady",
    archetype: arch.name,
    archetype_key: arch.key,
    baseline_stats: computeBaselineStats(a),
    streak_commitment: parseInt((a.streak_commitment as string) ?? "14", 10),
  };
}

export const PENDING_KEY = "lr_pending_onboarding";
export const QUIZ_KEY = "lr_quiz_answers";
