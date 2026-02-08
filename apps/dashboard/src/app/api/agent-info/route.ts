import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getDaemonStatus, readConfig } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent-info
 *
 * Returns the agent's display name, status, and emoji for the agent panel.
 */
export async function GET() {
  const isAuthenticated = await verifyAuth();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [daemonStatus, config] = await Promise.all([
      getDaemonStatus(),
      readConfig(),
    ]);

    // Try to extract bot name from config
    let name = "Atlas";
    let emoji = "🤖";

    if (config) {
      // Check channels.telegram for bot name
      const channels = config.channels as Record<string, Record<string, unknown>> | undefined;
      const telegram = channels?.telegram;
      if (telegram?.botName && typeof telegram.botName === "string") {
        name = telegram.botName;
      }

      // Check for a custom agent name in the config
      const agents = config.agents as Record<string, unknown> | undefined;
      const defaults = agents?.defaults as Record<string, unknown> | undefined;
      if (defaults?.name && typeof defaults.name === "string") {
        name = defaults.name;
      }
      if (defaults?.emoji && typeof defaults.emoji === "string") {
        emoji = defaults.emoji;
      }
    }

    // Map daemon status
    let status: "running" | "stopped" | "pending" = "stopped";
    if (daemonStatus.running) {
      status = "running";
    }

    return NextResponse.json({ name, status, emoji });
  } catch (err) {
    console.error("Failed to get agent info:", err);
    return NextResponse.json(
      { name: "Atlas", status: "stopped", emoji: "🤖" },
    );
  }
}
