import { NextResponse } from "next/server";
import { readState, saveIntegration } from "@/lib/integrations/server";
import { exchangeCode, GOOGLE_SCOPES, HEALTH_SCOPES } from "@/lib/integrations/google";

export const runtime = "nodejs";

// Google redirects here after consent, for both Tasks/Calendar and Google
// Health (the signed state says which). We verify the state, swap the code for
// tokens, store them, and bounce the user back into the app.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const parsed = state ? readState(state) : null;
  const provider = parsed?.p === "ghealth" ? "ghealth" : "google";
  const back = (status: string) => NextResponse.redirect(`${origin}/app/profile?${provider}=${status}`);

  if (err) return back("denied");
  if (!code || !parsed) return back("error");

  try {
    const t = await exchangeCode(code);
    await saveIntegration({
      user_id: parsed.uid,
      provider,
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? null,
      expiry: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      scope: t.scope ?? (provider === "ghealth" ? HEALTH_SCOPES : GOOGLE_SCOPES),
    });
    return back("connected");
  } catch {
    return back("error");
  }
}
