import { NextResponse } from "next/server";
import { readAgentIdentity } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent-public
 *
 * Public (unauthenticated) endpoint that returns the agent's
 * display name, emoji, and tagline for the login page.
 * Does NOT expose status or any sensitive config.
 */
export async function GET() {
  try {
    const identity = await readAgentIdentity();
    return NextResponse.json(identity);
  } catch {
    return NextResponse.json({
      name: "Atlas",
      emoji: "\u{1F916}",
      tagline: "Your AI Assistant",
    });
  }
}
