import { NextResponse } from "next/server";
import { userFromBearer, signState } from "@/lib/integrations/server";
import { consentUrl, HEALTH_SCOPES } from "@/lib/integrations/google";

export const runtime = "nodejs";

// Same Google OAuth client and redirect as Tasks/Calendar, asking only for the
// Google Health read scopes. The signed state marks it as a Health connection.
export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  return NextResponse.json({ url: consentUrl(signState(uid, "ghealth"), HEALTH_SCOPES) });
}
