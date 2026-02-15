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
 * Downloads a new dashboard version and restarts the systemd service.
 * Dashboard runs bare-metal (NOT Docker). See commit a5e0ef7.
 *
 * Headers: X-Admin-Secret: <secret>
 * Body: { tarballUrl: "https://github.com/.../dashboard-standalone.tar.gz" }
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!adminLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
  const installDir = process.env.INSTALL_DIR || "/opt/capable/dashboard";
  const backupDir = `${installDir}.backup`;
  const tmpFile = "/tmp/dashboard-upgrade.tar.gz";

  try {
    // Step 1: Download the tarball
    console.log(`Downloading dashboard from ${tarballUrl}...`);
    await execAsync(`curl -fsSL -o ${tmpFile} "${tarballUrl}"`, { timeout: 120000 });

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
    await execAsync(`tar -xzf ${tmpFile} -C ${installDir}`);

    // Step 5: Install native dependencies
    console.log("Installing native dependencies...");
    await execAsync(`cd ${installDir} && npm install --no-save node-pty ws`, { timeout: 120000 });

    // Step 6: Clean up
    console.log("Cleaning up...");
    await execAsync(`rm -f ${tmpFile}`);

    // Step 7: Restart the systemd service (detached so response can be sent)
    console.log("Restarting service...");
    const child = spawn("sh", ["-c", "sleep 1 && systemctl restart capable-dashboard"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

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
