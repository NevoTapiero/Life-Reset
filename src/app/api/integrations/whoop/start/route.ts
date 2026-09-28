import { NextResponse } from "next/server";
import { userFromBearer, signState } from "@/lib/integrations/server";
import { consentUrl, whoopConfigured } from "@/lib/integrations/whoop";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  if (!whoopConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  return NextResponse.json({ url: consentUrl(signState(uid)) });
}
