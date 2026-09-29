import { NextResponse } from "next/server";
import { userFromBearer, deleteIntegration } from "@/lib/integrations/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  await deleteIntegration(uid, "ghealth");
  return NextResponse.json({ connected: false });
}
