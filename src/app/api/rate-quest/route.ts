import { NextResponse } from "next/server";

// The System rates custom quests so players do not grade their own homework.
// Uses the Gemini API free tier; falls back to a standard rating without a key.

const VALID_XP = [10, 15, 20, 25];
const FALLBACK = { xp: 15, reason: "Standard daily effort.", source: "default" as const };

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
    "You rate daily habit quests for a gamified self-improvement app.",
    "Rate how much effort and willpower this DAILY habit takes and reply with JSON only:",
    '{"xp": <10|15|20|25>, "reason": "<one short sentence>"}',
    "Scale: 10 = trivial, under five minutes (drink water).",
    "15 = solid daily effort (read ten pages, journal).",
    "20 = hard, thirty plus minutes or real willpower (workout, deep work, no social media).",
    "25 = epic, most people fail this daily (5am run, full digital detox).",
    `Quest: "${title}" (life area: ${pillar || "unknown"})`,
  ].join("\n");

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!r.ok) return NextResponse.json(FALLBACK);
    const data = await r.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    const xp = VALID_XP.includes(parsed?.xp) ? (parsed.xp as number) : 15;
    const reason = String(parsed?.reason ?? "").slice(0, 140);
    return NextResponse.json({ xp, reason, source: "ai" });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
