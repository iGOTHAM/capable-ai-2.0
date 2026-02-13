import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * GET /api/events
 *
 * Returns events as a JSON array.
 * Optional query params:
 *   ?type=chat  — filter for chat.user_message / chat.bot_message events
 *   ?type=tool  — filter for tool.called events
 *   ?limit=50   — max number of events (most recent first)
 */
export async function GET(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let events = await readEvents();

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");
    const limitParam = searchParams.get("limit");

    if (typeFilter === "chat") {
      events = events.filter(
        (e) => e.type === "chat.user_message" || e.type === "chat.bot_message",
      );
    } else if (typeFilter) {
      events = events.filter((e) => e.type.startsWith(typeFilter));
    }

    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        events = events.slice(-limit);
      }
    }

    return NextResponse.json({ events });
  } catch (err) {
    console.error("Failed to read events:", err);
    return NextResponse.json({ events: [] });
  }
}
