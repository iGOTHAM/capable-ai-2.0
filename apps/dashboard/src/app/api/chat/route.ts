import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { appendEvent, getChatMessages } from "@/lib/events";

export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await getChatMessages();
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 },
    );
  }

  // Log user message
  await appendEvent({
    ts: new Date().toISOString(),
    runId: "chat-" + Date.now(),
    type: "chat.user_message",
    summary: message,
  });

  // Stub bot response — in production, this would call the agent runtime
  const botResponse =
    "Thank you for your message. The agent runtime integration will be connected in a future update. Your message has been logged.";

  await appendEvent({
    ts: new Date().toISOString(),
    runId: "chat-" + Date.now(),
    type: "chat.bot_message",
    summary: botResponse,
  });

  return NextResponse.json({ response: botResponse });
}
