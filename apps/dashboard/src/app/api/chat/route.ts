import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getChatMessages } from "@/lib/events";
import { processMessage, streamMessage, isBusy } from "@/lib/chat-engine";

// --- Route handlers ---

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

  if (isBusy()) {
    return NextResponse.json(
      { error: "Agent is busy processing another message. Please wait." },
      { status: 429 },
    );
  }

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 },
    );
  }

  // SSE streaming mode — client sends Accept: text/event-stream
  const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

  if (wantsStream) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamMessage(message)) {
            const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Stream failed";
          const data = `event: error\ndata: ${JSON.stringify({ type: "error", message: errorMsg })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Blocking mode — backwards compatible JSON response
  try {
    const result = await processMessage(message);

    return NextResponse.json({
      response: result.response,
      toolCalls: result.toolCalls.map((tc) => ({
        name: tc.name,
        args: tc.args,
      })),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to get response";

    if (errorMsg.includes("not configured") || errorMsg.includes("busy")) {
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
