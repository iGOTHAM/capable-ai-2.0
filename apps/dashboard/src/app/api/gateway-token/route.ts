import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { promises as fs } from "fs";

/**
 * GET /api/gateway-token
 *
 * Returns the OpenClaw gateway auth token so the dashboard chat page
 * can auto-redirect to /chat/?token=xxx without the user copying it.
 *
 * Protected by dashboard cookie auth (same as other dashboard pages).
 */
export async function GET() {
  const isAuthenticated = await verifyAuth();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fast path: Docker mode passes GATEWAY_TOKEN as env var
    const envToken = process.env.GATEWAY_TOKEN;
    if (envToken) {
      return NextResponse.json({ token: envToken });
    }

    const configPath =
      process.env.OPENCLAW_CONFIG ||
      process.env.CONFIG_FILE ||
      "/root/.openclaw/openclaw.json";

    const raw = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(raw) as {
      gateway?: { auth?: { token?: string } };
    };

    const token = config.gateway?.auth?.token;
    if (token) {
      return NextResponse.json({ token });
    }

    // Fallback: try reading a plain-text token file
    try {
      const fallbackPath = configPath.replace("openclaw.json", "gateway-token");
      const fallbackToken = (await fs.readFile(fallbackPath, "utf-8")).trim();
      if (fallbackToken) {
        return NextResponse.json({ token: fallbackToken });
      }
    } catch {
      // No fallback file
    }

    return NextResponse.json(
      { error: "Gateway token not configured" },
      { status: 404 },
    );
  } catch (err) {
    console.error("Failed to read gateway token:", err);
    return NextResponse.json(
      { error: "Failed to read gateway configuration" },
      { status: 500 },
    );
  }
}
