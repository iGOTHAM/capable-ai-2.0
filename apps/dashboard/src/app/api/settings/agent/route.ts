import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readConfig, writeConfig } from "@/lib/openclaw";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/agent
 * Returns the agent's identity fields: name, emoji, tagline.
 */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await readConfig();
    const agents = config?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;

    return NextResponse.json({
      name: (defaults?.name as string) || "Atlas",
      emoji: (defaults?.emoji as string) || "🤖",
      tagline: (defaults?.tagline as string) || "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read agent settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  emoji: z.string().min(1).max(10).optional(),
  tagline: z.string().max(200).optional(),
});

/**
 * PUT /api/settings/agent
 * Update agent identity fields in openclaw.json.
 */
export async function PUT(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = UpdateAgentSchema.parse(body);

    // Read existing config and deep-merge into agents.defaults
    const config = await readConfig();
    const existing = config || ({} as Record<string, unknown>);
    const agents = (existing.agents as Record<string, unknown>) ?? {};
    const defaults = (agents.defaults as Record<string, unknown>) ?? {};

    if (input.name !== undefined) defaults.name = input.name;
    if (input.emoji !== undefined) defaults.emoji = input.emoji;
    if (input.tagline !== undefined) defaults.tagline = input.tagline;

    agents.defaults = defaults;

    // Use writeConfig for the shallow merge — but we need to handle the agents object specifically
    // Write the full config to preserve nested structure
    const { writeFile, chmod } = await import("fs/promises");
    const configPath = process.env.OPENCLAW_CONFIG || "/root/.openclaw/openclaw.json";
    const merged = { ...existing, agents };
    await writeFile(configPath, JSON.stringify(merged, null, 2), "utf-8");
    await chmod(configPath, 0o600);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.errors },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to update agent settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
