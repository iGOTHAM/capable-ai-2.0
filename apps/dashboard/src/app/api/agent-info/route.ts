import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getDaemonStatus, readAgentIdentity } from "@/lib/openclaw";

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
    const [daemonStatus, identity] = await Promise.all([
      getDaemonStatus(),
      readAgentIdentity(),
    ]);

    // Map daemon status
    let status: "running" | "stopped" | "pending" = "stopped";
    if (daemonStatus.running) {
      status = "running";
    }

    return NextResponse.json({
      name: identity.name,
      status,
      emoji: identity.emoji,
    });
  } catch (err) {
    console.error("Failed to get agent info:", err);
    return NextResponse.json(
      { name: "Atlas", status: "stopped", emoji: "🤖" },
    );
  }
}
