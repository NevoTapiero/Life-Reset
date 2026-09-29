import { getIntegration, saveIntegration } from "./server";

// Google Tasks + Calendar. Read-only scopes; tokens refreshed on demand.

// Tasks needs write access so a task can be ticked off from inside the app.
// The calendar stays read-only: marking a meeting done is recorded here, never
// written back to the player's calendar.
const TASKS_WRITE = "https://www.googleapis.com/auth/tasks";
export const GOOGLE_SCOPES = [TASKS_WRITE, "https://www.googleapis.com/auth/calendar.readonly"].join(" ");

export const HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
].join(" ");

// Connections made before write access existed hold only tasks.readonly.
export function canWriteTasks(scope: string | null | undefined): boolean {
  return (scope ?? "").split(/\s+/).includes(TASKS_WRITE);
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

export function consentUrl(state: string, scopes: string = GOOGLE_SCOPES): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes,
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
// `provider` is "google" (Tasks/Calendar) or "ghealth" (Google Health): the same
// OAuth client, stored as two separate connections.
export async function freshAccessToken(uid: string, provider = "google"): Promise<string | null> {
  const row = await getIntegration(uid, provider);
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
    provider,
    access_token: t.access_token,
    refresh_token: row.refresh_token, // Google omits it on refresh; keep the old one
    expiry: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    scope: t.scope ?? row.scope,
  });
  return t.access_token;
}

export type GTask = {
  id: string;
  title: string;
  status?: string;
  completed?: string;
  due?: string;
  notes?: string;
  listId?: string;
};
export type GEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  calendarId?: string;
};

// Google's own interest calendars (holidays, birthdays, weather) are not a
// schedule anyone kept: they must never show up as the player's week or pay XP.
const CANNED_CALENDAR = /#(holiday|contacts|weather|sports)@group\.v\.calendar\.google\.com$/;
export function isCannedCalendar(id: string): boolean {
  return CANNED_CALENDAR.test(id);
}

// Google refusing a call and Google having nothing to return look identical
// once the error is swallowed, which makes an empty screen impossible to read.
// Every call records why it failed into a shared list instead.

export type ApiIssue = { api: string; status: number; message: string };

async function call(
  url: string,
  token: string,
  api: string,
  issues: ApiIssue[],
  init: { method?: string; body?: unknown } = {},
): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return await r.json();
    let message = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      message = body?.error?.message ?? body?.error_description ?? message;
    } catch {
      // keep the status-only message
    }
    issues.push({ api, status: r.status, message: String(message).slice(0, 300) });
    return null;
  } catch (e) {
    issues.push({ api, status: 0, message: e instanceof Error ? e.message : "request failed" });
    return null;
  }
}

// A short, human explanation of the first thing that went wrong, if anything.
export function explainIssues(issues: ApiIssue[]): string | null {
  const first = issues[0];
  if (!first) return null;
  const text = first.message.toLowerCase();
  if (first.status === 403 && (text.includes("has not been used") || text.includes("is disabled"))) {
    return `The ${first.api} API is switched off in your Google Cloud project.`;
  }
  if (first.status === 403 && text.includes("insufficient")) {
    return `Your connection is missing permission for ${first.api}. Disconnect and connect again.`;
  }
  if (first.status === 401) return "Your Google connection expired. Disconnect and connect again.";
  return `${first.api} said: ${first.message}`;
}

// Tasks completed since `sinceIso` across all of the user's task lists.
export async function completedTasksSince(
  token: string,
  sinceIso: string,
  issues: ApiIssue[] = [],
): Promise<GTask[]> {
  const listsBody = await call("https://tasks.googleapis.com/tasks/v1/users/@me/lists", token, "Google Tasks", issues);
  const lists = (listsBody?.items as { id: string }[]) ?? [];
  const out: GTask[] = [];
  for (const l of lists) {
    const p = new URLSearchParams({
      showCompleted: "true",
      showHidden: "true",
      completedMin: sinceIso,
      maxResults: "100",
    });
    const body = await call(`https://tasks.googleapis.com/tasks/v1/lists/${l.id}/tasks?${p}`, token, "Google Tasks", issues);
    const items = (body?.items as GTask[]) ?? [];
    for (const t of items) if (t.status === "completed" && t.title?.trim()) out.push({ ...t, listId: l.id });
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

// ---------------------------------------------------------------------------
// The app's day is the player's day (Asia/Jerusalem), not the server's UTC day.
// Getting this wrong made "today's events" a window shifted by three hours.

const TZ = "Asia/Jerusalem";

function zoneOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - at.getTime();
}

// Midnight-to-midnight in Jerusalem, as real instants. `days` extends the end.
export function localDayRange(days = 1, base = new Date()): { start: Date; end: Date } {
  const off = zoneOffsetMs(base);
  const shifted = new Date(base.getTime() + off);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const start = new Date(midnight - off);
  return { start, end: new Date(start.getTime() + days * 86400_000) };
}

// Every calendar the player actually keeps switched on, not just "primary":
// most people put their real schedule on a secondary or shared calendar.
export async function eventsEverywhere(
  token: string,
  minIso: string,
  maxIso: string,
  issues: ApiIssue[] = [],
): Promise<GEvent[]> {
  let ids = ["primary"];
  const listBody = await call(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
    token,
    "Google Calendar",
    issues,
  );
  const cals = (listBody?.items as { id: string; selected?: boolean; primary?: boolean }[]) ?? [];
  const on = cals
    .filter((c) => (c.primary || c.selected !== false) && !isCannedCalendar(c.id))
    .map((c) => c.id);
  if (on.length) ids = on.slice(0, 5);

  const p = new URLSearchParams({
    timeMin: minIso,
    timeMax: maxIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "40",
  });
  const lists = await Promise.all(
    ids.map(async (id) => {
      const body = await call(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${p}`,
        token,
        "Google Calendar",
        issues,
      );
      return ((body?.items as GEvent[]) ?? []).map((e) => ({ ...e, calendarId: id }));
    }),
  );
  const seen = new Set<string>();
  const out: GEvent[] = [];
  for (const e of lists.flat()) {
    const key = e.id + (e.start?.dateTime ?? e.start?.date ?? "");
    if (!e.id || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  const at = (e: GEvent) => new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00`).getTime();
  return out.sort((a, b) => at(a) - at(b));
}

// Still open: what the player has left to do, shown in the app as a live list.
export async function openTasks(token: string, issues: ApiIssue[] = []): Promise<GTask[]> {
  const listsBody = await call("https://tasks.googleapis.com/tasks/v1/users/@me/lists", token, "Google Tasks", issues);
  const lists = (listsBody?.items as { id: string }[]) ?? [];
  const out: GTask[] = [];
  for (const l of lists.slice(0, 5)) {
    const p = new URLSearchParams({ showCompleted: "false", maxResults: "50" });
    const body = await call(`https://tasks.googleapis.com/tasks/v1/lists/${l.id}/tasks?${p}`, token, "Google Tasks", issues);
    const items = (body?.items as GTask[]) ?? [];
    for (const t of items) if (t.title?.trim()) out.push({ ...t, listId: l.id });
  }
  // due first, undated last
  return out
    .sort((a, b) => (a.due ? new Date(a.due).getTime() : 8.64e15) - (b.due ? new Date(b.due).getTime() : 8.64e15))
    .slice(0, 25);
}

// ---------------------------------------------------------------------------
// Acting on an item from inside the app. The client only ever sends ids; the
// title, times and status are always re-read from Google, so nothing the
// browser claims about a task or meeting is trusted when XP is at stake.

export async function getTask(token: string, listId: string, taskId: string, issues: ApiIssue[] = []): Promise<GTask | null> {
  const body = await call(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    token,
    "Google Tasks",
    issues,
  );
  return body ? ({ ...(body as unknown as GTask), listId }) : null;
}

// Tick a task off in Google itself, so the player's list stays the truth.
export async function completeTask(token: string, listId: string, taskId: string, issues: ApiIssue[] = []): Promise<boolean> {
  const body = await call(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    token,
    "Google Tasks",
    issues,
    { method: "PATCH", body: { status: "completed" } },
  );
  return !!body && (body as { status?: string }).status === "completed";
}

// Which of the player's lists holds this task, for ledger rows paid before the
// list id was stored. Null if it is gone (deleted in Google).
export async function findTaskList(token: string, taskId: string, issues: ApiIssue[] = []): Promise<string | null> {
  const listsBody = await call("https://tasks.googleapis.com/tasks/v1/users/@me/lists", token, "Google Tasks", issues);
  for (const l of ((listsBody?.items as { id: string }[]) ?? []).slice(0, 10)) {
    const found = await call(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(l.id)}/tasks/${encodeURIComponent(taskId)}`,
      token,
      "Google Tasks",
      [], // a miss in one list is expected, not an issue
    );
    if (found && !(found as { deleted?: boolean }).deleted) return l.id;
  }
  return null;
}

// Put a task back on the list in Google, for when the player unchecks it here.
export async function reopenTask(token: string, listId: string, taskId: string, issues: ApiIssue[] = []): Promise<boolean> {
  const body = await call(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    token,
    "Google Tasks",
    issues,
    { method: "PATCH", body: { status: "needsAction", completed: null } },
  );
  return !!body && (body as { status?: string }).status === "needsAction";
}

export async function getEvent(token: string, calendarId: string, eventId: string, issues: ApiIssue[] = []): Promise<GEvent | null> {
  const body = await call(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    token,
    "Google Calendar",
    issues,
  );
  return body ? ({ ...(body as unknown as GEvent), calendarId }) : null;
}

export function eventStart(e: GEvent): number {
  const iso = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00` : null);
  return iso ? new Date(iso).getTime() : NaN;
}
