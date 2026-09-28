import { NextResponse } from "next/server";
import { verifyState, saveIntegration } from "@/lib/integrations/server";
import { exchangeCode, WHOOP_SCOPES } from "@/lib/integrations/whoop";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) return NextResponse.redirect(`${origin}/app/profile?whoop=denied`);
  if (!code || !state) return NextResponse.redirect(`${origin}/app/profile?whoop=error`);

  const uid = verifyState(state);
  if (!uid) return NextResponse.redirect(`${origin}/app/profile?whoop=error`);

  try {
    const t = await exchangeCode(code);
    await saveIntegration({
      user_id: uid,
      provider: "whoop",
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? null,
      expiry: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      scope: t.scope ?? WHOOP_SCOPES,
    });
    return NextResponse.redirect(`${origin}/app/profile?whoop=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/app/profile?whoop=error`);
  }
}
