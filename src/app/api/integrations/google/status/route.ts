import { NextResponse } from "next/server";
import { userFromBearer, getIntegration } from "@/lib/integrations/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  const row = await getIntegration(uid, "google");
  return NextResponse.json({ connected: !!row, last_sync: row?.last_sync ?? null });
}
