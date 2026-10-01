import { NextResponse } from "next/server";
import { WORKOUT_PRICING_NOTE, ratedFromTitle } from "@/lib/pricing";

// The System rates custom quests so players do not grade their own homework.
// Uses the Gemini API free tier; falls back to a standard rating without a key.

const FALLBACK = { xp: 10, reason: "Standard daily effort.", icon: "custom", source: "default" as const };

const ICONS = new Set([
  "droplet", "moon", "book", "dumbbell", "sun", "lotus", "pen", "snowflake", "phone-off",
  "target", "calendar", "users", "bulb", "sparkle", "apple", "screen-off", "leaf",
  "flame", "trophy", "chart", "tasks",
]);

// --- consistency with the player's friends -------------------------------
// The same habit must not be worth 12 XP for one friend and 15 for another, so
// the Judge is shown what the people around this player already run.

type PeerQuest = { title: string; xp: number; pillar: string; period?: string };

const STOP = new Set(['a','an','the','my','your','for','to','of','and','or','no','on','in','at','do','with','every','day','daily','minutes','minute','min','mins']);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9֐-׿ ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w)),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / new Set([...a, ...b]).size;
}

async function peerQuests(auth: string): Promise<PeerQuest[]> {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/peer_quests`, {
      method: 'POST',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        authorization: auth,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// The closest things the player's friends already run, best match first.
function closestPeers(title: string, peers: PeerQuest[]): { quest: PeerQuest; score: number }[] {
  const mine = tokens(title);
  return peers
    .map((quest) => ({ quest, score: similarity(mine, tokens(quest.title)) }))
    .filter((m) => m.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

async function isAuthed(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        authorization: auth,
      },
      signal: AbortSignal.timeout(5000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ---------- what a watch already measures ----------
// A connected Google Health / WHOOP pays for these by itself; a hand-made quest
// for the same thing would pay twice (10k steps: 10 XP from the watch, 14 more
// from the Judge). A fixed word check first, so the model can't talk its way
// past it, then the model's own verdict as a backup.
type Tracked = "steps" | "sleep" | "workout";
// Workouts first: "5k run" is a run (WHOOP measures it), not a step count.
const TRACK_WORDS: [Tracked, RegExp][] = [
  [
    "workout",
    /\bwork ?out\b|\bgym\b|\btrain(ing)?\b|\brun(ning)?\b|\bjog(ging)?\b|\blift(ing)?\b|\bcardio\b|\bhiit\b|\bswim(ming)?\b|\bcycl(e|ing)\b|\bbike\b|אימון|כושר|ריצה|לרוץ|שחייה/i,
  ],
  ["sleep", /\bsleep(ing)?\b|\bhours? of sleep\b|שינה|לישון|שעות שינה/i],
  ["steps", /\bsteps?\b|\b\d+\s?k\b|\bwalk(ing)?\b|צעדים|הליכה|ללכת/i],
];

function trackedByWords(title: string): Tracked | null {
  for (const [kind, re] of TRACK_WORDS) if (re.test(title)) return kind;
  return null;
}

// ---------- the scale depends on the period ----------
type Period = "daily" | "weekly" | "monthly";
const CAP: Record<Period, number> = { daily: 50, weekly: 100, monthly: 200 };
const ANCHORS: Record<Period, string[]> = {
  daily: [
    "- Drink a glass of water = 1",
    "- Make your bed = 2",
    "- 10 minute walk (about 1,100 steps) = 2",
    "- Read 10 pages = 12",
    "- 30 minute workout = 25",
    "- Run 5 km = 50",
    "- Keep Instagram or TikTok under one hour for the whole day = 50",
  ],
  weekly: [
    "- Call your grandparents once this week = 5",
    "- Do the weekly grocery shopping = 8",
    "- Plan and review the whole week = 15",
    "- Deep clean the whole apartment = 30",
    "- A 2 hour hike = 40",
    "- Run 15 km in one go = 80",
    "- Stay off social media for the entire week = 100",
  ],
  monthly: [
    "- Pay all the bills = 10",
    "- Visit a relative you rarely see = 20",
    "- Declutter and donate a full bag of things = 40",
    "- Read a whole book = 80",
    "- Learn and cook 4 new recipes = 90",
    "- Run a half marathon = 170",
    "- No alcohol for the entire month = 200",
  ],
};

export async function POST(req: Request) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }
  let body: { title?: unknown; pillar?: unknown; period?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  const pillar = typeof body.pillar === "string" ? body.pillar.slice(0, 20) : "";
  const period: Period = body.period === "weekly" || body.period === "monthly" ? body.period : "daily";
  const cap = CAP[period];
  if (title.length < 2) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const auth = req.headers.get("authorization") ?? "";

  // A workout, a stretch or a walk can always be made into a quest checked by
  // hand, even with a watch connected (1 Oct: a watch doesn't see everything,
  // e.g. stretching). The word check still sends steps and sleep through the
  // watch's price table so the same thing pays the same.
  const peers = await peerQuests(auth);
  const wordKind = trackedByWords(title);

  // Steps and sleep are never guessed: the number in the title goes through the
  // same price table a watch uses, so "10k steps" by hand pays what 10,000
  // steps from a watch pays. (Daily only: a watch has no weekly twin.)
  const priced = (kind: Tracked | null) => {
    if (period !== "daily" || (kind !== "steps" && kind !== "sleep")) return null;
    const rated = ratedFromTitle(kind, title);
    if (rated === null) return null;
    return NextResponse.json({
      xp: rated,
      reason:
        kind === "steps"
          ? "Priced like a watch prices steps: 10,000 steps = 20."
          : "Priced like a watch prices sleep: 7 to 9 hours = 12.",
      icon: kind === "steps" ? "leaf" : "moon",
      source: "price-table",
      tracks: kind,
    });
  };
  const fixed = priced(wordKind);
  if (fixed) return fixed;

  // What the people around this player already run for the same period, so the
  // same habit is priced the same for everyone in the group.
  const matches = closestPeers(title, peers.filter((q) => (q.period ?? "daily") === period));
  const twin = matches[0];
  if (twin && twin.score >= 0.85) {
    return NextResponse.json({
      xp: twin.quest.xp,
      reason: `Matched to the same quest your friends run. Same effort, same ${twin.quest.xp} XP.`,
      icon: "custom",
      source: "peer",
      matched: twin.quest.title,
      tracks: wordKind,
    });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ ...FALLBACK, tracks: wordKind });

  const peerLines = matches.length
    ? [
        "Quests the player's friends already run that are close to this one, with the XP they were given:",
        ...matches.map((m) => `- "${m.quest.title}" = ${m.quest.xp} XP`),
        "If this quest is essentially the same habit as one of those, give it exactly that XP.",
        "If it is a harder or wider version of one of them, stay close to it and add only a few points.",
        "Never price the same habit differently for two friends.",
      ]
    : [];

  const noun =
    period === "daily" ? "DAILY habit" : period === "weekly" ? "WEEKLY quest (done once a week)" : "MONTHLY quest (done once a month)";
  const what = period === "daily" ? "daily habit" : `thing to do once a ${period === "weekly" ? "week" : "month"}`;
  const prompt = [
    `You are the Judge, a strict and unimpressed rater of ${period} quests in a self-improvement RPG.`,
    `FIRST check the quest is a real, feasible ${what} a person can actually do. If it is gibberish, nonsense, impossible, illegal, harmful, or not an action at all, reply with JSON only: {"nonsense": true} and nothing else.`,
    `Otherwise score how much real effort and willpower this ${noun} costs, as an integer from 1 to ${cap}.`,
    "Be harsh, precise and consistent. Trivial actions get almost nothing. Do not inflate.",
    "Never call yourself anything in the reason; just state the verdict bluntly.",
    "Calibration anchors, follow them exactly:",
    ...ANCHORS[period],
    "Interpolate between anchors. Reserve the top fifth of the scale for feats that demand serious discipline.",
    ...peerLines,
    ...(period === "daily" ? [WORKOUT_PRICING_NOTE] : []),
    'Also say whether a fitness watch measures this on its own: "steps" (a step count or walking), "sleep" (hours slept), "workout" (exercise, gym, running, sport), or "none".',
    "Also pick the single best matching icon name from this exact list:",
    "droplet, moon, book, dumbbell, sun, lotus, pen, snowflake, phone-off, target, calendar, users, bulb, sparkle, apple, screen-off, leaf, flame, trophy, chart, tasks",
    `Reply with JSON only: {"xp": <integer 1-${cap}>, "reason": "<one short blunt sentence>", "icon": "<name from the list>", "tracks": "steps" | "sleep" | "workout" | "none"}`,
    `Quest: "${title}" (life area: ${pillar || "unknown"})`,
  ].join("\n");

  // the free tier gets demand spikes: walk a chain of models until one answers
  const models = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(9000),
        },
      );
      if (!r.ok) continue;
      const data = await r.json();
      const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
      const parsed = JSON.parse(text);
      if (parsed?.nonsense === true) {
        return NextResponse.json({ nonsense: true, source: "ai" });
      }
      const raw = Number(parsed?.xp);
      if (!Number.isFinite(raw)) continue;
      const modelKind = (["steps", "sleep", "workout"] as const).find((k) => k === parsed?.tracks) ?? null;
      const tracks = wordKind ?? modelKind;
      // the model spotted steps or sleep the word check missed: price it, don't trust its number
      const latePriced = priced(tracks);
      if (latePriced) return latePriced;
      let xp = Math.min(cap, Math.max(1, Math.round(raw)));
      // A clear variant of a quest a friend already runs stays in that quest's
      // range, whatever the model felt like. Same habit, same price.
      if (twin && twin.score >= 0.5) {
        xp = Math.min(cap, Math.max(1, Math.min(Math.max(xp, twin.quest.xp - 3), twin.quest.xp + 8)));
      }
      const reason = String(parsed?.reason ?? "").slice(0, 140);
      const icon = ICONS.has(parsed?.icon) ? (parsed.icon as string) : "custom";
      return NextResponse.json({
        xp,
        reason,
        icon,
        source: "ai",
        tracks,
        ...(twin && twin.score >= 0.5 ? { matched: twin.quest.title } : {}),
      });
    } catch {
      continue;
    }
  }
  return NextResponse.json({ ...FALLBACK, tracks: wordKind });
}
