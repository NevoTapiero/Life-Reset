import { NextResponse } from "next/server";
import { verifyState, saveIntegration } from "@/lib/integrations/server";
import { exchangeCode, GOOGLE_SCOPES } from "@/lib/integrations/google";

export const runtime = "nodejs";

// Google redirects here after consent. We verify the signed state, swap the code
// for tokens, store them, and bounce the user back into the app.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) return NextResponse.redirect(`${origin}/app/profile?google=denied`);
  if (!code || !state) return NextResponse.redirect(`${origin}/app/profile?google=error`);

  const uid = verifyState(state);
  if (!uid) return NextResponse.redirect(`${origin}/app/profile?google=error`);

  try {
    const t = await exchangeCode(code);
    await saveIntegration({
      user_id: uid,
      provider: "google",
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? null,
      expiry: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      scope: t.scope ?? GOOGLE_SCOPES,
    });
    return NextResponse.redirect(`${origin}/app/profile?google=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/app/profile?google=error`);
  }
}
