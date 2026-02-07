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

    // Update config using OpenClaw's documented schema format:
    // - env.ANTHROPIC_API_KEY or env.OPENAI_API_KEY for API keys
    // - agents.defaults.model.primary for model selection (e.g. "anthropic/claude-sonnet-4-5")
    // Remove any legacy fields from previous config attempts
    delete config.provider;
    delete config.apiKey;
    delete config.model;
    delete config.models; // Remove old models.providers format

    // Set env with provider API key
    const env = (config.env as Record<string, string>) ?? {};
    if (provider === "anthropic") {
      env.ANTHROPIC_API_KEY = apiKey;
    } else if (provider === "openai") {
      env.OPENAI_API_KEY = apiKey;
    }
    config.env = env;

    // Set agents.defaults.model.primary as "provider/model"
    const agents = (config.agents as Record<string, unknown>) ?? {};
    const defaults = (agents.defaults as Record<string, unknown>) ?? {};
    defaults.model = { primary: `${provider}/${model}` };
    agents.defaults = defaults;
    config.agents = agents;

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
    // Try multiple service names (onboard creates openclaw-gateway, manual creates capable-openclaw)
    const { promisify } = await import("util");
    const execPromise = promisify(exec);

    let serviceStatus = "unknown";
    let journalOutput = "";

    // Try restarting both possible service names
    const serviceNames = ["capable-openclaw", "openclaw-gateway"];
    for (const svcName of serviceNames) {
      try {
        // Try system-level first
        await execPromise(`systemctl restart ${svcName} 2>/dev/null || systemctl --user restart ${svcName} 2>/dev/null`);
        break;
      } catch {
        // Service might not exist under this name, try next
      }
    }

    // Give it time to start
    await new Promise(r => setTimeout(r, 5000));

    // Check if port 18789 is now listening
    try {
      const { stdout: portCheck } = await execPromise("ss -lntp | grep 18789 || echo 'not listening'");
      serviceStatus = portCheck.includes("18789") ? "active" : "inactive";

      if (serviceStatus !== "active") {
        // Gather diagnostics
        const { stdout: journal } = await execPromise(
          "journalctl -u capable-openclaw --no-pager -n 20 2>&1; journalctl --user-unit openclaw-gateway --no-pager -n 20 2>&1; cat /var/log/openclaw.log 2>/dev/null | tail -20"
        ).catch(() => ({ stdout: "" }));
        journalOutput = journal.slice(0, 3000);
      }
    } catch {
      serviceStatus = "check-failed";
    }

    return NextResponse.json({ success: true, serviceStatus, journalOutput: journalOutput || undefined });
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
