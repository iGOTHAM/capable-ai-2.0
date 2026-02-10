import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { safeCompare } from "@/lib/auth";
import { adminLimiter } from "@/lib/rate-limit";

const execAsync = promisify(exec);

/** Only allow tarballs from our specific GitHub repository releases */
const ALLOWED_URL_PREFIXES = [
  "https://github.com/iGOTHAM/capable-ai-2.0/releases/",
  "https://api.github.com/repos/iGOTHAM/capable-ai-2.0/",
] as const;

const upgradeSchema = z.object({
  tarballUrl: z
    .string()
    .url()
    .refine(
      (url) => ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix)),
      { message: "Tarball URL must be from the Capable.ai GitHub repository releases" }
    ),
});

/**
 * POST /api/admin/upgrade-dashboard
 *
 * Downloads a new dashboard version and restarts the service.
 * This endpoint will NOT return a response if successful (service restarts).
 *
 * Headers: X-Admin-Secret: <secret>
 * Body: { tarballUrl: "https://github.com/.../dashboard-standalone.tar.gz" }
 *
 * Response:
 *   200: Never returned on success (service restarts)
 *   400: { error: "..." }
 *   401: { error: "Unauthorized" }
 *   500: { error: "..." }
 */
export async function POST(req: NextRequest) {
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

  // Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = upgradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { tarballUrl } = parsed.data;

  // Installation directory
  const installDir = process.env.INSTALL_DIR || "/opt/capable-ai";
  const backupDir = `${installDir}.backup`;
  const tmpFile = "/tmp/dashboard-upgrade.tar.gz";

  try {
    // Step 1: Download the tarball
    console.log(`Downloading dashboard from ${tarballUrl}...`);
    await execAsync(`curl -fsSL -o ${tmpFile} "${tarballUrl}"`);

    // Step 2: Verify it's a valid tarball
    console.log("Verifying tarball...");
    await execAsync(`tar -tzf ${tmpFile} > /dev/null`);

    // Step 3: Create backup of current installation
    console.log("Creating backup...");
    await execAsync(`rm -rf ${backupDir}`);
    await execAsync(`cp -a ${installDir} ${backupDir}`);

    // Step 4: Extract new dashboard
    console.log("Extracting new dashboard...");
    await execAsync(`rm -rf ${installDir}/*`);
    await execAsync(`tar -xzf ${tmpFile} -C ${installDir} --strip-components=1`);

    // Step 5: Copy over environment file (preserve config)
    console.log("Preserving environment configuration...");
    const envFile = "/etc/capable-dashboard.env";
    // Environment file should be preserved by systemd service, no action needed

    // Step 6: Clean up
    console.log("Cleaning up...");
    await execAsync(`rm -f ${tmpFile}`);

    // Step 7: Restart the service
    // This will terminate this process, so we won't return a response
    console.log("Restarting service...");

    // Use spawn with detached to ensure the restart command continues even after this process dies
    // Small delay to allow response to be sent (though it likely won't make it)
    if (process.env.CONTAINER_MODE === "docker") {
      // Docker mode: rebuild and restart dashboard container
      const child = spawn("sh", ["-c", "sleep 1 && docker restart capable-dashboard"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else {
      // Bare-metal mode: restart systemd service
      const child = spawn("sh", ["-c", "sleep 1 && systemctl restart capable-dashboard"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }

    // Try to return success, but the restart may interrupt this
    return NextResponse.json({
      success: true,
      message: "Upgrade initiated. Service is restarting...",
    });
  } catch (err) {
    console.error("Upgrade failed:", err);

    // Attempt rollback
    try {
      console.log("Attempting rollback...");
      await execAsync(`rm -rf ${installDir}`);
      await execAsync(`mv ${backupDir} ${installDir}`);
      console.log("Rollback successful");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Upgrade failed. Rollback attempted.",
      },
      { status: 500 }
    );
  }
}
