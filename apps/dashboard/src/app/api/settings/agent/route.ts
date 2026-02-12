import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readAgentIdentity, writeAgentIdentity } from "@/lib/openclaw";
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
    const identity = await readAgentIdentity();
    return NextResponse.json(identity);
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
 * Update agent identity fields in agent-identity.json (separate from openclaw.json).
 */
export async function PUT(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = UpdateAgentSchema.parse(body);
    await writeAgentIdentity(input);
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
