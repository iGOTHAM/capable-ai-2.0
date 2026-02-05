import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/admin/status
 *
 * Returns the current status of the dashboard deployment.
 *
 * Headers: X-Admin-Secret: <secret>
 *
 * Response:
 *   200: {
 *     packVersion: number | null,
 *     dashboardVersion: string,
 *     mode: "DRAFT_ONLY" | "ASK_FIRST" | "UNKNOWN",
 *     uptime: number (seconds),
 *     workspaceFiles: string[]
 *   }
 *   401: { error: "Unauthorized" }
 *   500: { error: "..." }
 */

const startTime = Date.now();

export async function GET(req: NextRequest) {
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

  const workspaceDir =
    process.env.WORKSPACE_DIR || "/root/.openclaw/workspace";
  const configPath =
    process.env.CONFIG_FILE || "/root/.openclaw/openclaw.json";

  try {
    // Get pack version from config or manifest
    let packVersion: number | null = null;
    try {
      const manifestPath = path.join(workspaceDir, ".manifest.json");
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
      packVersion = manifest.version ?? null;
    } catch {
      // No manifest file, try config
      try {
        const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
        packVersion = config.packVersion ?? null;
      } catch {
        // No config either
      }
    }

    // Get dashboard version from package.json or git commit
    let dashboardVersion = "unknown";
    try {
      // Try reading version from environment (set during build)
      dashboardVersion = process.env.DASHBOARD_VERSION || process.env.npm_package_version || "unknown";
    } catch {
      // Fallback
    }

    // Detect mode from AGENTS.md content
    let mode: "DRAFT_ONLY" | "ASK_FIRST" | "UNKNOWN" = "UNKNOWN";
    try {
      const agentsPath = path.join(workspaceDir, "AGENTS.md");
      const agentsContent = await fs.readFile(agentsPath, "utf-8");

      if (agentsContent.includes("# Agent Rules — Active Mode")) {
        mode = "DRAFT_ONLY";
      } else if (agentsContent.includes("# Agent Rules — Do It — Ask Me First")) {
        mode = "ASK_FIRST";
      }
    } catch {
      // AGENTS.md doesn't exist
    }

    // Calculate uptime
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    // List workspace files
    let workspaceFiles: string[] = [];
    try {
      const files = await fs.readdir(workspaceDir);
      workspaceFiles = files;
    } catch {
      // Workspace doesn't exist
    }

    return NextResponse.json({
      packVersion,
      dashboardVersion,
      mode,
      uptime,
      workspaceFiles,
    });
  } catch (err) {
    console.error("Failed to get status:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to get status",
      },
      { status: 500 }
    );
  }
}
