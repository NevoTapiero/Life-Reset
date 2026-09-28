import { getIntegration, saveIntegration } from "./server";

// WHOOP v2 API. OAuth2 authorization-code flow; objective scores map straight to
// XP (recovery %, sleep performance %, workout strain), so no Judge is needed.

const API = "https://api.prod.whoop.com/developer";
const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

// `offline` is required for WHOOP to return a refresh token.
export const WHOOP_SCOPES = [
  "offline",
  "read:recovery",
  "read:sleep",
  "read:workout",
  "read:profile",
].join(" ");

const CLIENT_ID = process.env.WHOOP_CLIENT_ID || "";
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.WHOOP_REDIRECT_URI || "";

export function whoopConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

export function consentUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: WHOOP_SCOPES,
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

type TokenResp = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

export async function exchangeCode(code: string): Promise<TokenResp> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!r.ok) throw new Error(`whoop token exchange failed: ${r.status}`);
  return r.json();
}

export async function freshAccessToken(uid: string): Promise<string | null> {
  const row = await getIntegration(uid, "whoop");
  if (!row) return null;
  const valid = row.expiry && new Date(row.expiry).getTime() - Date.now() > 60_000;
  if (valid) return row.access_token;
  if (!row.refresh_token) return row.access_token ?? null;
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: WHOOP_SCOPES,
    }),
  });
  if (!r.ok) return null;
  const t: TokenResp = await r.json();
  await saveIntegration({
    user_id: uid,
    provider: "whoop",
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? row.refresh_token, // WHOOP rotates refresh tokens
    expiry: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    scope: t.scope ?? row.scope,
  });
  return t.access_token;
}

async function collection(token: string, path: string, since: string) {
  const p = new URLSearchParams({ limit: "25", start: since });
  const r = await fetch(`${API}${path}?${p}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return [];
  return (await r.json())?.records ?? [];
}

type Scored = { score_state?: string };
type SleepRec = Scored & { id: string; nap?: boolean; score?: { sleep_performance_percentage?: number } };
type RecoveryRec = Scored & { cycle_id: number; score?: { recovery_score?: number } };
type WorkoutRec = Scored & { id: string; sport_name?: string; score?: { strain?: number } };

export async function recentSleep(token: string, since: string): Promise<SleepRec[]> {
  return collection(token, "/v2/activity/sleep", since);
}
export async function recentRecovery(token: string, since: string): Promise<RecoveryRec[]> {
  return collection(token, "/v2/recovery", since);
}
export async function recentWorkouts(token: string, since: string): Promise<WorkoutRec[]> {
  return collection(token, "/v2/activity/workout", since);
}
