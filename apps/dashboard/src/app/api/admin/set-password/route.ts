import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { execSync } from "child_process";

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
  // Validate admin secret
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin endpoint not configured" },
      { status: 500 }
    );
  }

  const providedSecret = req.headers.get("X-Admin-Secret");
  if (providedSecret !== adminSecret) {
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
    // Update the environment file used by systemd
    const envPath = "/etc/capable-dashboard.env";

    // Read existing env file or create new one
    let envContent = "";
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, "utf8");
    }

    // Update or add AUTH_PASSWORD
    const lines = envContent.split("\n").filter((line) => line.trim());
    const newLines = lines.filter(
      (line) => !line.startsWith("AUTH_PASSWORD=")
    );
    newLines.push(`AUTH_PASSWORD=${password}`);

    // Write back
    writeFileSync(envPath, newLines.join("\n") + "\n", { mode: 0o600 });

    // Also update the credentials file for reference
    const credentialsPath = "/root/dashboard-credentials.txt";
    writeFileSync(
      credentialsPath,
      `Dashboard Password: ${password}\nUpdated: ${new Date().toISOString()}\n`,
      { mode: 0o600 }
    );

    // Restart the dashboard service to pick up new password
    try {
      execSync("systemctl restart capable-dashboard", { timeout: 10000 });
    } catch {
      // Service might not be running via systemd in dev mode
      console.log("Note: Could not restart systemd service (may be dev mode)");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to set password:", err);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}
