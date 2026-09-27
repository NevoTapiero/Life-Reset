import { NextResponse } from "next/server";

// The System rates custom quests so players do not grade their own homework.
// Uses the Gemini API free tier; falls back to a standard rating without a key.

const FALLBACK = { xp: 10, reason: "Standard daily effort.", icon: "custom", source: "default" as const };

const ICONS = new Set([
  "droplet", "moon", "book", "dumbbell", "sun", "lotus", "pen", "snowflake", "phone-off",
  "target", "calendar", "users", "bulb", "sparkle", "apple", "screen-off", "leaf",
  "flame", "trophy", "chart", "tasks",
]);

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

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json(FALLBACK);

  const prompt = [
    "You are the Judge, a strict and unimpressed rater of daily habit quests in a self-improvement RPG.",
    "Score how much real effort and willpower this DAILY habit costs, as an integer from 1 to 50.",
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
      const raw = Number(parsed?.xp);
      if (!Number.isFinite(raw)) continue;
      const xp = Math.min(50, Math.max(1, Math.round(raw)));
      const reason = String(parsed?.reason ?? "").slice(0, 140);
      const icon = ICONS.has(parsed?.icon) ? (parsed.icon as string) : "custom";
      return NextResponse.json({ xp, reason, icon, source: "ai" });
    } catch {
      continue;
    }
  }
  return NextResponse.json(FALLBACK);
}
