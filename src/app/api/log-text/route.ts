import { NextResponse } from "next/server";
import { userFromBearer } from "@/lib/integrations/server";

// "Tell the Judge": the player writes (or says) what they did, in their own
// words, and we match it to their open missions. This route only MATCHES: it
// returns mission ids from the list the player sent. Checking them still goes
// through complete_quest_for with the player's own session, so every XP rule
// on the server still applies and nothing here can pay XP.

type Mission = { id: string; title: string };

const MAX_TEXT = 300;
const MAX_MISSIONS = 40;

// plain word overlap, used when the model is unavailable
const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "for", "in", "on", "my", "i", "did", "done", "today", "with", "at", "some", "min", "minutes", "hour", "hours", "x"]);
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿ ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

// Word overlap can't read "I didn't run" or "will read tonight", so when the
// sentence has a negation or a plan in it, the fallback matches nothing.
const NOT_DONE = /(not|no|didn'?t|did not|don'?t|never|skip(ped)?|missed|will|going to|gonna|later|tomorrow|tonight|plan(ning)?)|(^|s)(לא|אל|בלי|מחר|אתמול|אעשה|אלך|אקרא|ארוץ|נעשה|מתכנן|מתכננת|אולי)(s|$)/i;

function wordMatch(text: string, missions: Mission[]): string[] {
  if (NOT_DONE.test(text)) return [];
  const said = new Set(words(text));
  return missions.filter((m) => words(m.title).some((w) => said.has(w) || said.has(w.replace(/s$/, "")))).map((m) => m.id);
}

async function modelMatch(text: string, missions: Mission[]): Promise<{ ids: string[]; reply: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const list = missions.map((m, i) => `${i + 1}. ${m.title}`).join("\n");
  const prompt = [
    "You help a player log real-life habits in a LEGO habit game.",
    "The player tells you what they did today. Pick which of their missions they clearly completed.",
    "Only include a mission when the text clearly says it was done (not planned, not partly, not 'will').",
    "The player may write in English or Hebrew. Numbers and durations must fit the mission (a 5 minute walk does not complete a 30 minute walk).",
    "Write the reply in the same language the player used.",
    'Reply with JSON only: {"picks": [<mission numbers>], "reply": "<one short, warm sentence, no emojis>"}',
    `Missions:\n${list}`,
    `Player: "${text}"`,
  ].join("\n");
  const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
  for (const m of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const out = parts.filter((x: { thought?: boolean }) => !x.thought).map((x: { text?: string }) => x.text).join("");
      const parsed = JSON.parse(out);
      const picks: unknown[] = Array.isArray(parsed?.picks) ? parsed.picks : [];
      const ids = [...new Set(picks.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= missions.length).map((n) => missions[n - 1].id))];
      return { ids, reply: String(parsed?.reply ?? "").slice(0, 140) };
    } catch {
      continue;
    }
  }
  return null;
}

// A few logs a minute per player is plenty; this keeps a script from burning
// the Gemini quota. Per server instance (good enough for a friends' app).
const RATE = { max: 6, windowMs: 60_000 };
const hits = new Map<string, number[]>();
function limited(uid: string): boolean {
  const now = Date.now();
  const recent = (hits.get(uid) ?? []).filter((t) => now - t < RATE.windowMs);
  if (recent.length >= RATE.max) {
    hits.set(uid, recent);
    return true;
  }
  recent.push(now);
  hits.set(uid, recent);
  if (hits.size > 500) for (const [k, v] of hits) if (v.every((t) => now - t >= RATE.windowMs)) hits.delete(k);
  return false;
}

export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (limited(uid)) return NextResponse.json({ error: "too many" }, { status: 429 });
  let body: { text?: unknown; missions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  const missions = (Array.isArray(body.missions) ? body.missions : [])
    .filter((m): m is Mission => !!m && typeof (m as Mission).id === "string" && typeof (m as Mission).title === "string")
    .slice(0, MAX_MISSIONS)
    .map((m) => ({ id: m.id.slice(0, 80), title: m.title.slice(0, 80) }));
  if (text.length < 2 || missions.length === 0) return NextResponse.json({ ids: [], reply: "" });

  const judged = await modelMatch(text, missions);
  if (judged) return NextResponse.json({ ids: judged.ids, reply: judged.reply, by: "judge" });
  return NextResponse.json({ ids: wordMatch(text, missions), reply: "", by: "words" });
}
