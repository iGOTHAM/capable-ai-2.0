import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { safeCompare } from "@/lib/auth";
import { adminLimiter } from "@/lib/rate-limit";

const execAsync = promisify(exec);
// v3: comprehensive diagnostics with secret redaction

/** Redact sensitive values from config/log strings before returning to callers */
function redactSecrets(text: string): string {
  return text
    // API keys: sk-ant-..., sk-..., key-...
    .replace(/\b(sk-ant-[a-zA-Z0-9_-]{8})[a-zA-Z0-9_-]*/g, "$1…REDACTED")
    .replace(/\b(sk-[a-zA-Z0-9]{8})[a-zA-Z0-9]*/g, "$1…REDACTED")
    // Hex tokens/secrets (32+ hex chars, e.g. gateway tokens, admin secrets)
    .replace(/\b([0-9a-f]{8})[0-9a-f]{24,}\b/gi, "$1…REDACTED")
    // Generic "key": "value" or KEY=value patterns for sensitive field names
    .replace(/(["']?(?:api[_-]?key|secret|token|password|ANTHROPIC_API_KEY|OPENAI_API_KEY|AUTH_PASSWORD|ADMIN_SECRET)["']?\s*[:=]\s*["']?)([^"'\s,}{]{8})[^"'\s,}{]*/gi, "$1$2…REDACTED");
}

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
  // Rate limit admin API calls
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!adminLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Validate admin secret
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin secret not configured on this deployment" },
      { status: 500 }
    );
  }

  const providedSecret = req.headers.get("X-Admin-Secret");
  if (!providedSecret || !safeCompare(providedSecret, adminSecret)) {
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
      if (process.env.CONTAINER_MODE === "docker") {
        // Docker mode: check container status
        const { stdout: containerStatus } = await execAsync("docker inspect -f '{{.State.Status}}' capable-openclaw 2>/dev/null").catch(() => ({ stdout: "not found" }));
        openclawService = containerStatus.trim() === "running" ? "active" : containerStatus.trim();
      } else {
        const { stdout: svcStatus } = await execAsync("systemctl is-active capable-openclaw").catch(() => ({ stdout: "inactive" }));
        openclawService = svcStatus.trim();
      }
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
      if (process.env.CONTAINER_MODE === "docker") {
        const { stdout: journal } = await execAsync("docker logs --tail 50 capable-openclaw 2>&1").catch(() => ({ stdout: "" }));
        openclawJournal = journal.slice(0, 4000);
      } else {
        const { stdout: journal } = await execAsync("journalctl -u capable-openclaw --no-pager -n 50 2>&1").catch(() => ({ stdout: "" }));
        openclawJournal = journal.slice(0, 4000);
      }
    } catch { /* ignore */ }
    try {
      if (process.env.CONTAINER_MODE === "docker") {
        const { stdout: cj } = await execAsync("docker logs --tail 20 capable-caddy 2>&1").catch(() => ({ stdout: "" }));
        caddyJournal = cj.slice(0, 2000);
      } else {
        const { stdout: cj } = await execAsync("journalctl -u caddy --no-pager -n 20 2>&1").catch(() => ({ stdout: "" }));
        caddyJournal = cj.slice(0, 2000);
      }
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
    // Check openclaw binary and available commands
    let openclawDirect = "";
    try {
      // Check the actual binary path and contents
      const { stdout: whichOut } = await execAsync("which openclaw && file $(which openclaw) && ls -la $(which openclaw) 2>&1 || true", { timeout: 5000 }).catch((e) => ({ stdout: String(e?.message || "") }));

      // Read the openclaw.mjs entry point to understand what it does
      const { stdout: headMjs } = await execAsync("head -30 /usr/lib/node_modules/openclaw/openclaw.mjs 2>&1 || echo 'file not found'", { timeout: 5000 }).catch((e) => ({ stdout: String(e?.message || "") }));

      // List the openclaw package directory
      const { stdout: lsPackage } = await execAsync("ls -la /usr/lib/node_modules/openclaw/ 2>&1 || echo 'dir not found'", { timeout: 5000 }).catch((e) => ({ stdout: String(e?.message || "") }));

      // Try running the binary with node directly and capture stderr
      const { stdout: nodeRun } = await execAsync("node /usr/lib/node_modules/openclaw/openclaw.mjs --version 2>&1 || echo 'EXIT_CODE='$?", { timeout: 10000 }).catch((e) => ({ stdout: String(e?.message || "") }));

      // Check openclaw package.json for bin/main fields
      const { stdout: pkgJson } = await execAsync("cat /usr/lib/node_modules/openclaw/package.json 2>&1 | head -30 || echo 'not found'", { timeout: 5000 }).catch((e) => ({ stdout: String(e?.message || "") }));

      // Read /var/log/openclaw.log
      const { stdout: logContent } = await execAsync("cat /var/log/openclaw.log 2>&1 || echo 'no log file'", { timeout: 5000 }).catch((e) => ({ stdout: String(e?.message || "") }));

      // Try npm list -g openclaw to see version
      const { stdout: npmList } = await execAsync("npm list -g openclaw 2>&1 || true", { timeout: 10000 }).catch((e) => ({ stdout: String(e?.message || "") }));

      openclawDirect = `WHICH: ${whichOut.trim()}\n\nHEAD_MJS: ${headMjs.slice(0, 1000)}\n\nLS_PACKAGE: ${lsPackage.slice(0, 1000)}\n\nNODE_RUN: ${nodeRun.slice(0, 1000)}\n\nPKG_JSON: ${pkgJson.slice(0, 1000)}\n\nLOG_FILE: ${logContent.slice(0, 2000)}\n\nNPM_LIST: ${npmList.trim()}`;
    } catch (e) { openclawDirect = "exec failed: " + String(e); }

    return NextResponse.json({
      packVersion,
      dashboardVersion,
      uptime,
      workspaceFiles,
      openclawService,
      openclawPort,
      allPorts,
      openclawJournal: redactSecrets(openclawJournal),
      caddyJournal,
      openclawConfig: redactSecrets(openclawConfig),
      openclawUnitFile: redactSecrets(openclawUnitFile),
      curlLocalhost,
      openclawDirect: redactSecrets(openclawDirect),
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
