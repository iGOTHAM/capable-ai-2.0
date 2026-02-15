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

  const isDocker = process.env.CONTAINER_MODE === "docker";
  const tmpFile = "/tmp/dashboard-upgrade.tar.gz";

  try {
    if (isDocker) {
      // ── Docker mode ──
      // The dashboard runs inside a Docker container with docker.sock mounted.
      // To upgrade: download tarball, extract to host build dir, rebuild image,
      // and recreate the container via docker compose.
      const hostDir = "/opt/capable"; // Host directory (accessed via docker commands)

      // Step 1: Download the tarball (inside this container)
      console.log(`[docker] Downloading dashboard from ${tarballUrl}...`);
      await execAsync(`curl -fsSL -o ${tmpFile} "${tarballUrl}"`, { timeout: 120000 });

      // Step 2: Verify it's a valid tarball
      console.log("[docker] Verifying tarball...");
      await execAsync(`tar -tzf ${tmpFile} > /dev/null`);

      // Step 3: Copy tarball to host and extract using a temporary container
      // We use a helper container that mounts the host dir to extract the tarball
      console.log("[docker] Extracting tarball to host build directory...");
      await execAsync(
        `docker run --rm -v ${hostDir}:/host -v ${tmpFile}:/tmp/upgrade.tar.gz alpine sh -c "` +
        `rm -rf /host/dashboard-build && mkdir -p /host/dashboard-build && ` +
        `tar -xzf /tmp/upgrade.tar.gz -C /host/dashboard-build"`,
        { timeout: 60000 }
      );

      // Step 4: Rebuild the Docker image on the host
      console.log("[docker] Rebuilding dashboard Docker image...");
      await execAsync(
        `docker build -f ${hostDir}/Dockerfile.dashboard -t capable-ai/dashboard:latest ${hostDir}`,
        { timeout: 300000 }
      );

      // Step 5: Clean up
      console.log("[docker] Cleaning up...");
      await execAsync(`rm -f ${tmpFile}`);

      // Step 6: Recreate the container with the new image
      // This kills the current process, so spawn detached
      console.log("[docker] Recreating container...");
      const child = spawn("sh", ["-c",
        `sleep 1 && cd ${hostDir} && docker compose up -d --force-recreate dashboard`
      ], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else {
      // ── Bare-metal / systemd mode ──
      const installDir = process.env.INSTALL_DIR || "/opt/capable/dashboard";
      const backupDir = `${installDir}.backup`;

      // Step 1: Download the tarball
      console.log(`[bare-metal] Downloading dashboard from ${tarballUrl}...`);
      await execAsync(`curl -fsSL -o ${tmpFile} "${tarballUrl}"`, { timeout: 120000 });

      // Step 2: Verify it's a valid tarball
      console.log("[bare-metal] Verifying tarball...");
      await execAsync(`tar -tzf ${tmpFile} > /dev/null`);

      // Step 3: Create backup of current installation
      console.log("[bare-metal] Creating backup...");
      await execAsync(`rm -rf ${backupDir}`);
      await execAsync(`cp -a ${installDir} ${backupDir}`);

      // Step 4: Extract new dashboard
      console.log("[bare-metal] Extracting new dashboard...");
      await execAsync(`rm -rf ${installDir}/*`);
      await execAsync(`tar -xzf ${tmpFile} -C ${installDir}`);

      // Step 5: Install native dependencies
      console.log("[bare-metal] Installing native dependencies...");
      await execAsync(`cd ${installDir} && npm install --no-save node-pty ws`, { timeout: 120000 });

      // Step 6: Clean up
      console.log("[bare-metal] Cleaning up...");
      await execAsync(`rm -f ${tmpFile}`);

      // Step 7: Restart the systemd service
      console.log("[bare-metal] Restarting service...");
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

    // Attempt rollback (bare-metal only — Docker mode is image-based, old image still exists)
    if (!isDocker) {
      const installDir = process.env.INSTALL_DIR || "/opt/capable/dashboard";
      const backupDir = `${installDir}.backup`;
      try {
        console.log("Attempting rollback...");
        await execAsync(`rm -rf ${installDir}`);
        await execAsync(`mv ${backupDir} ${installDir}`);
        console.log("Rollback successful");
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
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
