import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { safeCompare } from "@/lib/auth";
import { adminLimiter } from "@/lib/rate-limit";

/**
 * POST /api/admin/set-password
 *
 * Updates the dashboard password. Protected by ADMIN_SECRET header.
 * This endpoint is called by the Capable.ai web app when a user
 * clicks "Regenerate Password" on their project page.
 *
 * Request:
 *   Headers: { "X-Admin-Secret": "<ADMIN_SECRET>" }
 *   Body: { "password": "<new-password>" }
 *
 * Response:
 *   200: { "success": true }
 *   401: { "error": "Unauthorized" }
 *   500: { "error": "<message>" }
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
      { error: "Admin endpoint not configured" },
      { status: 500 }
    );
  }

  const providedSecret = req.headers.get("X-Admin-Secret");
  if (!providedSecret || !safeCompare(providedSecret, adminSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { password } = body;
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  try {
    // ── 1. Update process.env in-memory so auth uses the new password immediately ──
    // auth.ts reads process.env.AUTH_PASSWORD dynamically (via getAuthSecret()),
    // and middleware.ts reads it on every request. No restart needed.
    process.env.AUTH_PASSWORD = password;

    // ── 2. Persist to disk so the password survives container/service restarts ──
    const isDocker = process.env.CONTAINER_MODE === "docker";
    const envPath = isDocker ? "/opt/capable/.env" : "/etc/capable-dashboard.env";

    try {
      if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, "utf8");
        const lines = envContent.split("\n").filter((line) => line.trim());
        const newLines = lines.filter(
          (line) => !line.startsWith("AUTH_PASSWORD=")
        );
        newLines.push(`AUTH_PASSWORD=${password}`);
        writeFileSync(envPath, newLines.join("\n") + "\n", { mode: 0o600 });
      } else {
        writeFileSync(envPath, `AUTH_PASSWORD=${password}\n`, { mode: 0o600 });
      }
    } catch (fsErr) {
      console.error("Failed to persist password to disk:", fsErr);
      // In-memory update still worked, so continue
    }

    if (!isDocker) {
      // Bare-metal: also update systemd unit file if it has inline env
      const servicePath = "/etc/systemd/system/capable-dashboard.service";
      if (existsSync(servicePath)) {
        try {
          const serviceContent = readFileSync(servicePath, "utf8");
          if (serviceContent.includes("Environment=AUTH_PASSWORD=")) {
            const updated = serviceContent.replace(
              /Environment=AUTH_PASSWORD=.*/,
              `Environment=AUTH_PASSWORD=${password}`
            );
            writeFileSync(servicePath, updated);
          }
        } catch {
          // Non-critical — env file is the primary persistence
        }
      }
    }

    // ── 3. Update credentials reference file ──
    try {
      const credentialsPath = "/root/dashboard-credentials.txt";
      writeFileSync(
        credentialsPath,
        `Dashboard Password: ${password}\nUpdated: ${new Date().toISOString()}\n`,
        { mode: 0o600 }
      );
    } catch {
      // Non-critical
    }

    // NOTE: We do NOT restart the container/service here.
    // The in-memory process.env update takes effect immediately.
    // Restarting the container from inside itself would kill this
    // request handler before it can respond → timeout on the caller.

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to set password:", err);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}
