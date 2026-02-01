import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/events";

export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const approvals = await getPendingApprovals();
  return NextResponse.json({ approvals });
}
