import { NextResponse } from "next/server";
import { userFromBearer } from "@/lib/integrations/server";
import { syncWhoop } from "@/lib/integrations/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const uid = await userFromBearer(req);
  if (!uid) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  return NextResponse.json(await syncWhoop(uid));
}
