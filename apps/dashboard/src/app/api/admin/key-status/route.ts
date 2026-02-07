import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";

/**
 * GET /api/admin/key-status
 *
 * Checks whether an LLM API key is already configured in openclaw.json.
 * Used by the web app to skip the "Connect AI" form if the key was
 * already sent (e.g., from the wizard's sessionStorage auto-send).
 *
 * Headers: X-Admin-Secret: <secret>
 * Response: { configured: boolean, provider?: "anthropic" | "openai" }
 */
export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin secret not configured" },
      { status: 500 },
    );
  }

  const providedSecret = req.headers.get("X-Admin-Secret");
  if (!providedSecret || providedSecret !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const configPath =
      process.env.OPENCLAW_CONFIG ||
      process.env.CONFIG_FILE ||
      "/root/.openclaw/openclaw.json";

    let config: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(raw);
    } catch {
      // Config doesn't exist — key is not configured
      return NextResponse.json({ configured: false });
    }

    const env = config.env as Record<string, string> | undefined;
    if (!env) {
      return NextResponse.json({ configured: false });
    }

    const anthropicKey = env.ANTHROPIC_API_KEY;
    const openaiKey = env.OPENAI_API_KEY;

    // Treat dummy/placeholder keys as not configured
    const isDummy = (key?: string) =>
      !key || key === "sk-test-dummy" || key.length < 10;

    if (!isDummy(anthropicKey)) {
      return NextResponse.json({ configured: true, provider: "anthropic" });
    }

    if (!isDummy(openaiKey)) {
      return NextResponse.json({ configured: true, provider: "openai" });
    }

    return NextResponse.json({ configured: false });
  } catch (err) {
    console.error("Failed to check key status:", err);
    return NextResponse.json(
      { error: "Failed to read configuration" },
      { status: 500 },
    );
  }
}
