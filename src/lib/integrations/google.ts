import { getIntegration, saveIntegration } from "./server";

// Google Tasks + Calendar. Read-only scopes; tokens refreshed on demand.

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

export function consentUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

type TokenResp = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

export async function exchangeCode(code: string): Promise<TokenResp> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) throw new Error(`token exchange failed: ${r.status}`);
  return r.json();
}

// Return a valid access token, refreshing (and persisting) if it has expired.
export async function freshAccessToken(uid: string): Promise<string | null> {
  const row = await getIntegration(uid, "google");
  if (!row) return null;
  const stillValid = row.expiry && new Date(row.expiry).getTime() - Date.now() > 60_000;
  if (stillValid) return row.access_token;
  if (!row.refresh_token) return row.access_token ?? null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) return null;
  const t: TokenResp = await r.json();
  await saveIntegration({
    user_id: uid,
    provider: "google",
    access_token: t.access_token,
    refresh_token: row.refresh_token, // Google omits it on refresh; keep the old one
    expiry: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    scope: t.scope ?? row.scope,
  });
  return t.access_token;
}

export type GTask = { id: string; title: string; completed?: string };
export type GEvent = { id: string; summary?: string; start?: { dateTime?: string; date?: string } };

// Tasks completed since `sinceIso` across all of the user's task lists.
export async function completedTasksSince(token: string, sinceIso: string): Promise<GTask[]> {
  const listsRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!listsRes.ok) return [];
  const lists = (await listsRes.json())?.items ?? [];
  const out: GTask[] = [];
  for (const l of lists) {
    const p = new URLSearchParams({
      showCompleted: "true",
      showHidden: "true",
      completedMin: sinceIso,
      maxResults: "100",
    });
    const r = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${l.id}/tasks?${p}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) continue;
    const items = (await r.json())?.items ?? [];
    for (const t of items) if (t.status === "completed" && t.title?.trim()) out.push(t);
  }
  return out;
}

// Events on the user's primary calendar for the given local day range.
export async function eventsBetween(token: string, minIso: string, maxIso: string): Promise<GEvent[]> {
  const p = new URLSearchParams({
    timeMin: minIso,
    timeMax: maxIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return [];
  return (await r.json())?.items ?? [];
}

// The Judge (Gemini, free tier) rates how much effort a real-world item is
// worth, 1..50. Best-effort: returns a base score if the model is unavailable.
export async function judge(title: string, kind: "task" | "event", base: number): Promise<{ xp: number; reason: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { xp: base, reason: "" };
  const prompt = [
    "You are the Judge, a strict rater of real-life effort in a self-improvement RPG.",
    `Rate how much genuine effort/importance this ${kind} represents, as an integer 1 to 50.`,
    "Be consistent and not generous. Trivial items get a few points; demanding ones get more.",
    'Reply with JSON only: {"xp": <int 1-50>, "reason": "<one short blunt sentence>"}',
    `${kind}: "${title.slice(0, 120)}"`,
  ].join("\n");
  const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];
  for (const m of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!r.ok) continue;
      const data = await r.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((x: { thought?: boolean }) => !x.thought).map((x: { text?: string }) => x.text).join("");
      const parsed = JSON.parse(text);
      const xp = Number(parsed?.xp);
      if (Number.isFinite(xp)) return { xp: Math.min(50, Math.max(1, Math.round(xp))), reason: String(parsed?.reason ?? "").slice(0, 140) };
    } catch {
      continue;
    }
  }
  return { xp: base, reason: "" };
}
