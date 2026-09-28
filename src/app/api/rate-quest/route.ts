import { NextResponse } from "next/server";

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

type PeerQuest = { title: string; xp: number; pillar: string };

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

export async function POST(req: Request) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }
  let body: { title?: unknown; pillar?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  const pillar = typeof body.pillar === "string" ? body.pillar.slice(0, 20) : "";
  if (title.length < 2) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  // What the people around this player already run, so the same habit is priced
  // the same for everyone in the group.
  const peers = await peerQuests(req.headers.get("authorization") ?? "");
  const matches = closestPeers(title, peers);
  const twin = matches[0];
  if (twin && twin.score >= 0.85) {
    return NextResponse.json({
      xp: twin.quest.xp,
      reason: `Matched to the same quest your friends run. Same effort, same ${twin.quest.xp} XP.`,
      icon: "custom",
      source: "peer",
      matched: twin.quest.title,
    });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json(FALLBACK);

  const peerLines = matches.length
    ? [
        "Quests the player's friends already run that are close to this one, with the XP they were given:",
        ...matches.map((m) => `- "${m.quest.title}" = ${m.quest.xp} XP`),
        "If this quest is essentially the same habit as one of those, give it exactly that XP.",
        "If it is a harder or wider version of one of them, stay close to it and add only a few points.",
        "Never price the same habit differently for two friends.",
      ]
    : [];

  const prompt = [
    "You are the Judge, a strict and unimpressed rater of daily habit quests in a self-improvement RPG.",
    'FIRST check the quest is a real, feasible daily habit a person can actually do. If it is gibberish, nonsense, impossible, illegal, harmful, or not an action at all, reply with JSON only: {"nonsense": true} and nothing else.',
    "Otherwise score how much real effort and willpower this DAILY habit costs, as an integer from 1 to 50.",
    "Be harsh, precise and consistent. Trivial actions get almost nothing. Do not inflate.",
    "Never call yourself anything in the reason; just state the verdict bluntly.",
    "Calibration anchors, follow them exactly:",
    "- Drink a glass of water = 1",
    "- Make your bed = 2",
    "- 10 minute walk = 8",
    "- Read 10 pages = 12",
    "- 30 minute workout = 25",
    "- Run 5 km = 50",
    "- Keep Instagram or TikTok under one hour for the whole day = 50",
    "Interpolate between anchors. Reserve 40 to 50 for feats that demand serious discipline.",
    ...peerLines,
    "Also pick the single best matching icon name from this exact list:",
    "droplet, moon, book, dumbbell, sun, lotus, pen, snowflake, phone-off, target, calendar, users, bulb, sparkle, apple, screen-off, leaf, flame, trophy, chart, tasks",
    'Reply with JSON only: {"xp": <integer 1-50>, "reason": "<one short blunt sentence>", "icon": "<name from the list>"}',
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
      let xp = Math.min(50, Math.max(1, Math.round(raw)));
      // A clear variant of a quest a friend already runs stays in that quest's
      // range, whatever the model felt like. Same habit, same price.
      if (twin && twin.score >= 0.5) {
        xp = Math.min(50, Math.max(1, Math.min(Math.max(xp, twin.quest.xp - 3), twin.quest.xp + 8)));
      }
      const reason = String(parsed?.reason ?? "").slice(0, 140);
      const icon = ICONS.has(parsed?.icon) ? (parsed.icon as string) : "custom";
      return NextResponse.json({ xp, reason, icon, source: "ai", ...(twin && twin.score >= 0.5 ? { matched: twin.quest.title } : {}) });
    } catch {
      continue;
    }
  }
  return NextResponse.json(FALLBACK);
}
