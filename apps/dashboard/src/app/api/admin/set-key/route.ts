import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { promises as fs } from "fs";
import { exec } from "child_process";
import path from "path";

const setKeySchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

/**
 * POST /api/admin/set-key
 *
 * Receives LLM provider credentials and writes them to openclaw.json.
 * Called by the web app after deployment becomes ACTIVE.
 *
 * Headers: X-Admin-Secret: <secret>
 * Body: { provider: "anthropic" | "openai", apiKey: string, model: string }
 *
 * Response:
 *   200: { success: true }
 *   400: { error: "..." }
 *   401: { error: "Unauthorized" }
 *   500: { error: "..." }
 */
export async function POST(req: NextRequest) {
  // Validate admin secret
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin secret not configured on this deployment" },
      { status: 500 }
    );
  }

  const providedSecret = req.headers.get("X-Admin-Secret");
  if (!providedSecret || providedSecret !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = setKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { provider, apiKey, model } = parsed.data;

  try {
    const configPath =
      process.env.OPENCLAW_CONFIG ||
      process.env.CONFIG_FILE ||
      "/root/.openclaw/openclaw.json";

    // Read existing config
    let config: Record<string, unknown> = {};
    try {
      const existing = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(existing);
    } catch {
      // Config doesn't exist yet, start fresh
    }

    // Update provider, apiKey, model
    config.provider = provider;
    config.apiKey = apiKey;
    config.model = model;

    // Ensure config directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });

    // Write updated config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    // Remove .setup-pending marker if present
    const openclawDir =
      process.env.OPENCLAW_DIR || path.dirname(configPath);
    const markerPath = path.join(openclawDir, ".setup-pending");
    try {
      await fs.unlink(markerPath);
    } catch {
      // Marker doesn't exist, that's fine
    }

    // Restart OpenClaw service so it picks up the new config
    exec("systemctl restart capable-openclaw", (err) => {
      if (err) console.error("Failed to restart OpenClaw service:", err.message);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to set key:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update configuration",
      },
      { status: 500 }
    );
  }
}
