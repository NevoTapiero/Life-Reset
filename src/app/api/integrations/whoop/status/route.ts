import { NextResponse } from "next/server";
import { userFromBearer, getIntegration } from "@/lib/integrations/server";
import { whoopConfigured } from "@/lib/integrations/whoop";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  if (!whoopConfigured()) return NextResponse.json({ configured: false, connected: false });
  const row = await getIntegration(uid, "whoop");
  return NextResponse.json({ configured: true, connected: !!row, last_sync: row?.last_sync ?? null });
}
