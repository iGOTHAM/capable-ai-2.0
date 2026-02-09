import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * GET /api/events
 *
 * Returns all events as a JSON array for client-side rendering.
 */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const events = await readEvents();
    return NextResponse.json({ events });
  } catch (err) {
    console.error("Failed to read events:", err);
    return NextResponse.json({ events: [] });
  }
}
