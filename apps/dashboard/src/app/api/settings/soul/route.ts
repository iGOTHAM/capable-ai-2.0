import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const WORKSPACE = path.join(OPENCLAW_DIR, "workspace");
const SOUL_PATH = path.join(WORKSPACE, "SOUL.md");

/**
 * GET /api/settings/soul
 * Returns the SOUL.md content and metadata.
 */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stat = await fs.stat(SOUL_PATH);
    const content = await fs.readFile(SOUL_PATH, "utf-8");
    return NextResponse.json({
      content,
      modified: stat.mtime.toISOString(),
      size: stat.size,
    });
  } catch {
    return NextResponse.json(
      { error: "SOUL.md not found" },
      { status: 404 },
    );
  }
}

const UpdateSoulSchema = z.object({
  content: z.string().min(1).max(50000),
});

/**
 * PUT /api/settings/soul
 * Update SOUL.md content. This bypasses the docs.ts read-only
 * classification — the settings page is the authorized edit path
 * for system files.
 */
export async function PUT(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content } = UpdateSoulSchema.parse(body);

    await fs.mkdir(path.dirname(SOUL_PATH), { recursive: true });
    await fs.writeFile(SOUL_PATH, content, "utf-8");

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.errors },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to save SOUL.md";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
