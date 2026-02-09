import { NextResponse } from "next/server";
import { readConfig } from "@/lib/openclaw";

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
    const config = await readConfig();

    let name = "Atlas";
    let emoji = "\u{1F916}";
    let tagline = "Your AI Assistant";

    if (config) {
      const agents = config.agents as Record<string, unknown> | undefined;
      const defaults = agents?.defaults as Record<string, unknown> | undefined;
      if (defaults?.name && typeof defaults.name === "string") {
        name = defaults.name;
      }
      if (defaults?.emoji && typeof defaults.emoji === "string") {
        emoji = defaults.emoji;
      }
      if (defaults?.tagline && typeof defaults.tagline === "string") {
        tagline = defaults.tagline;
      }
    }

    return NextResponse.json({ name, emoji, tagline });
  } catch {
    return NextResponse.json({
      name: "Atlas",
      emoji: "\u{1F916}",
      tagline: "Your AI Assistant",
    });
  }
}
