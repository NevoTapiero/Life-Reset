import crypto from "crypto";

// Server-only helpers for third-party integrations. None of this is exposed to
// the browser: secrets live in env, tokens live in the service-role-only
// `integrations` table, and XP is granted through the idempotent xp_ledger.

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STATE_SECRET = process.env.INTEGRATION_STATE_SECRET || "dev-secret";

// Identify the signed-in user from their Supabase access token (sent as a
// Bearer header by the browser client).
export async function userFromBearer(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const r = await fetch(`${SUPA}/auth/v1/user`, {
      headers: { apikey: ANON, authorization: auth },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ?? null;
  } catch {
    return null;
  }
}

// Short-lived signed state carried through the OAuth redirect so the callback
// can trust which user it belongs to (the redirect can't carry our session).
// `p` names which product is being connected, so one Google redirect URI can
// serve both Tasks/Calendar and Google Health without registering another.
export function signState(uid: string, p?: string): string {
  const body = Buffer.from(JSON.stringify({ uid, p, ts: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readState(state: string): { uid: string; p: string | null } | null {
  try {
    const [body, sig] = state.split(".");
    if (!body || !sig) return null;
    const expect = crypto.createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
    if (sig.length !== expect.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const { uid, p, ts } = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!uid || Date.now() - ts > 15 * 60 * 1000) return null; // 15 min window
    return { uid, p: typeof p === "string" ? p : null };
  } catch {
    return null;
  }
}

export function verifyState(state: string): string | null {
  return readState(state)?.uid ?? null;
}

// Every item already paid for, ref -> when it was paid, so screens can show
// them as done and reconciliation can leave brand new payments alone.
export async function paidAt(uid: string, sources: string[]): Promise<Map<string, number>> {
  try {
    const r = await fetch(
      `${SUPA}/rest/v1/xp_ledger?user_id=eq.${uid}&source=in.(${sources.join(",")})&select=ref,created_at`,
      { headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` } },
    );
    const rows = await r.json();
    return new Map(
      Array.isArray(rows)
        ? rows.map((x: { ref: string; created_at: string }) => [x.ref, new Date(x.created_at).getTime()])
        : [],
    );
  } catch {
    return new Map();
  }
}

export async function paidRefs(uid: string, sources: string[]): Promise<Set<string>> {
  return new Set((await paidAt(uid, sources)).keys());
}

// Paid items of one source with their stored meta, ref -> meta.
export async function paidMeta(uid: string, source: string): Promise<Map<string, Record<string, unknown>>> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/xp_ledger?user_id=eq.${uid}&source=eq.${source}&select=ref,meta`, {
      headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
    });
    const rows = await r.json();
    return new Map(
      Array.isArray(rows) ? rows.map((x: { ref: string; meta: Record<string, unknown> | null }) => [x.ref, x.meta ?? {}]) : [],
    );
  } catch {
    return new Map();
  }
}

// Re-price an item that was already paid (e.g. a workout re-scored by intensity).
// Returns the XP difference applied to the player.
export async function rescoreXp(
  uid: string,
  source: string,
  ref: string,
  xp: number,
  reason: string,
  meta: Record<string, unknown>,
): Promise<number> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/rescore_external_xp`, {
      method: "POST",
      headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user: uid, p_source: source, p_ref: ref, p_xp: xp, p_reason: reason, p_meta: meta }),
    });
    const n = Number(await r.json());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

// Take back the XP for one item (the player unchecked it). Returns the amount.
export async function revokeXp(uid: string, source: string, ref: string): Promise<number> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/revoke_external_xp`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user: uid, p_source: source, p_ref: ref }),
    });
    const n = Number(await r.json());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

// --- service-role data access (bypasses RLS; server only) ---

export async function saveIntegration(row: {
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string | null;
  expiry: string;
  scope: string;
}) {
  await fetch(`${SUPA}/rest/v1/integrations?on_conflict=user_id,provider`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
}

export async function getIntegration(uid: string, provider: string) {
  const r = await fetch(
    `${SUPA}/rest/v1/integrations?user_id=eq.${uid}&provider=eq.${provider}&select=*`,
    { headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` } },
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function deleteIntegration(uid: string, provider: string) {
  await fetch(`${SUPA}/rest/v1/integrations?user_id=eq.${uid}&provider=eq.${provider}`, {
    method: "DELETE",
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
  });
}

export async function touchSync(uid: string, provider: string) {
  await fetch(`${SUPA}/rest/v1/integrations?user_id=eq.${uid}&provider=eq.${provider}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ last_sync: new Date().toISOString() }),
  });
}

// Grant XP once per external item. Returns true if it was newly awarded.
export async function awardXp(
  uid: string,
  source: string,
  ref: string,
  xp: number,
  reason: string,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/award_external_xp`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user: uid,
        p_source: source,
        p_ref: ref,
        p_xp: xp,
        p_reason: reason,
        p_meta: meta ?? null,
      }),
    });
    return (await r.json()) === true;
  } catch {
    return false;
  }
}

// Re-price a player's cards (quests and watch items alike) and their total.
export async function recalcPlayer(uid: string): Promise<void> {
  try {
    await fetch(`${SUPA}/rest/v1/rpc/recalc_player`, {
      method: "POST",
      headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_uid: uid }),
    });
  } catch {
    // the next check or sync recomputes it anyway
  }
}

// Sum of a player's ledger XP for these sources, to report what a sync changed.
export async function ledgerTotal(uid: string, sources: string[]): Promise<number> {
  try {
    const r = await fetch(
      `${SUPA}/rest/v1/xp_ledger?user_id=eq.${uid}&source=in.(${sources.join(",")})&select=xp`,
      { headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` } },
    );
    const rows = await r.json();
    return Array.isArray(rows) ? rows.reduce((s: number, x: { xp: number }) => s + (x.xp ?? 0), 0) : 0;
  } catch {
    return 0;
  }
}
