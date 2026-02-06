import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getChatMessages } from "@/lib/events";

/**
 * GET /api/chat — Return chat history from event log.
 */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await getChatMessages();
  return NextResponse.json({ messages });
}

/**
 * POST /api/chat — Stub.
 * The custom chat engine has been removed. Chat is now handled
 * natively by OpenClaw's Web UI on port 18789.
 */
export async function POST() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Chat is now handled by OpenClaw. Use the OpenClaw Web UI.",
      redirect: "http://localhost:18789",
    },
    { status: 410 },
  );
}
