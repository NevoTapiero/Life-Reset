import { NextResponse } from "next/server";
import { userFromBearer, signState } from "@/lib/integrations/server";
import { consentUrl } from "@/lib/integrations/google";

export const runtime = "nodejs";

// The client calls this with its Bearer token; we return the Google consent URL
// (with a signed state) for the browser to navigate to.
export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  return NextResponse.json({ url: consentUrl(signState(uid)) });
}
