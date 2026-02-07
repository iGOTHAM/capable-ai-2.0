import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

    // OpenClaw diagnostics
    let openclawService = "unknown";
    let openclawPort = "unknown";
    let openclawJournal = "";
    let caddyJournal = "";
    let allPorts = "";
    let openclawConfig = "";
    let openclawUnitFile = "";
    let curlLocalhost = "";
    try {
      const { stdout: svcStatus } = await execAsync("systemctl is-active capable-openclaw").catch(() => ({ stdout: "inactive" }));
      openclawService = svcStatus.trim();
    } catch { /* ignore */ }
    try {
      const { stdout: portCheck } = await execAsync("ss -lntp | grep 18789").catch(() => ({ stdout: "none" }));
      openclawPort = portCheck.trim() || "not listening on 18789";
    } catch { openclawPort = "check failed"; }
    try {
      const { stdout: ap } = await execAsync("ss -lntp").catch(() => ({ stdout: "" }));
      allPorts = ap.slice(0, 2000);
    } catch { /* ignore */ }
    try {
      const { stdout: journal } = await execAsync("journalctl -u capable-openclaw --no-pager -n 50 2>&1").catch(() => ({ stdout: "" }));
      openclawJournal = journal.slice(0, 4000);
    } catch { /* ignore */ }
    try {
      const { stdout: cj } = await execAsync("journalctl -u caddy --no-pager -n 20 2>&1").catch(() => ({ stdout: "" }));
      caddyJournal = cj.slice(0, 2000);
    } catch { /* ignore */ }
    try {
      const cfg = await fs.readFile("/root/.openclaw/openclaw.json", "utf-8");
      openclawConfig = cfg.slice(0, 1000);
    } catch { openclawConfig = "not found"; }
    try {
      const { stdout: unit } = await execAsync("cat /etc/systemd/system/capable-openclaw.service 2>&1").catch(() => ({ stdout: "" }));
      openclawUnitFile = unit.slice(0, 1000);
    } catch { /* ignore */ }
    try {
      const { stdout: curl } = await execAsync("curl -sf --connect-timeout 3 http://127.0.0.1:18789/ 2>&1 || echo 'CURL_FAILED'").catch(() => ({ stdout: "exec failed" }));
      curlLocalhost = curl.slice(0, 500);
    } catch { curlLocalhost = "exec failed"; }

    return NextResponse.json({
      packVersion,
      dashboardVersion,
      uptime,
      workspaceFiles,
      openclawService,
      openclawPort,
      allPorts,
      openclawJournal,
      caddyJournal,
      openclawConfig,
      openclawUnitFile,
      curlLocalhost,
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
