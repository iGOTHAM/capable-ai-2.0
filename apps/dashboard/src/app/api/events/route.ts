import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getLatestEvents } from "@/lib/events";

export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await getLatestEvents(100);
  return NextResponse.json({ events });
}
