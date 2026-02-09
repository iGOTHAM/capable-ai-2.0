import { NextRequest, NextResponse } from "next/server";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
} from "fs";
import { join, dirname, resolve, normalize } from "path";
import { safeCompare } from "@/lib/auth";
import { adminLimiter } from "@/lib/rate-limit";

/**
 * POST /api/admin/update-pack
 *
 * Updates pack files (SOUL.md, AGENTS.md, etc.) on the running droplet.
 * Protected by ADMIN_SECRET header.
 *
 * This endpoint is called by the Capable.ai web app when a user
 * clicks "Push Update" to sync new pack files to their deployment.
 *
 * Request:
 *   Headers: { "X-Admin-Secret": "<ADMIN_SECRET>" }
 *   Body: {
 *     "files": { "SOUL.md": "...", "AGENTS.md": "...", ... },
 *     "version": 2
 *   }
 *
 * Response:
 *   200: { "success": true, "version": 2 }
 *   401: { "error": "Unauthorized" }
 *   400: { "error": "..." }
 *   500: { "error": "..." }
 *
 * IMPORTANT: This endpoint NEVER touches /data/activity/ - conversation
 * history is always preserved.
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
  let body: { files?: Record<string, string>; version?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { files, version } = body;
  if (!files || typeof files !== "object" || Object.keys(files).length === 0) {
    return NextResponse.json(
      { error: "No files provided" },
      { status: 400 }
    );
  }

  if (typeof version !== "number" || version < 1) {
    return NextResponse.json(
      { error: "Invalid version number" },
      { status: 400 }
    );
  }

  const workspacePath =
    process.env.OPENCLAW_DIR
      ? join(process.env.OPENCLAW_DIR, "workspace")
      : "/root/.openclaw/workspace";
  const backupPath = workspacePath + ".backup";

  try {
    // Step 1: Create backup of current workspace
    if (existsSync(workspacePath)) {
      // Remove old backup if exists
      if (existsSync(backupPath)) {
        rmSync(backupPath, { recursive: true, force: true });
      }
      // Copy current workspace to backup
      cpSync(workspacePath, backupPath, { recursive: true });
    }

    // Step 2: Validate ALL filenames before writing any files
    const resolvedWorkspace = resolve(workspacePath);
    const filesToWrite: Array<{ filename: string; filePath: string; content: string }> = [];

    for (const [filename, content] of Object.entries(files)) {
      // Skip activity files - they should never be overwritten
      if (filename.startsWith("activity/")) {
        continue;
      }

      // Hard reject path traversal — return 400 immediately, don't silently skip
      const normalized = normalize(filename);
      if (normalized.startsWith("..") || normalized.includes("/../") || filename.startsWith("/")) {
        console.error(`Path traversal attempt rejected: ${filename}`);
        return NextResponse.json(
          { error: `Invalid filename: path traversal detected in "${filename}"` },
          { status: 400 }
        );
      }

      const filePath = resolve(join(workspacePath, filename));
      // Double-check the resolved path is still inside the workspace
      if (!filePath.startsWith(resolvedWorkspace)) {
        console.error(`Path traversal blocked: ${filename} resolved to ${filePath}`);
        return NextResponse.json(
          { error: `Invalid filename: "${filename}" escapes workspace directory` },
          { status: 400 }
        );
      }

      filesToWrite.push({ filename, filePath, content });
    }

    // Step 3: Write validated files
    for (const { filePath, content } of filesToWrite) {
      const fileDir = dirname(filePath);

      // Ensure directory exists
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }

      // Write file
      writeFileSync(filePath, content, "utf8");
    }

    // Step 4: Verify files were written
    for (const { filename, filePath } of filesToWrite) {
      if (!existsSync(filePath)) {
        throw new Error(`Failed to write file: ${filename}`);
      }
    }

    // Step 5: Success - remove backup
    if (existsSync(backupPath)) {
      rmSync(backupPath, { recursive: true, force: true });
    }

    // Step 6: Write version marker
    const versionPath = join(workspacePath, ".pack-version");
    writeFileSync(versionPath, String(version), "utf8");

    return NextResponse.json({ success: true, version });
  } catch (err) {
    console.error("Failed to update pack:", err);

    // Rollback: restore from backup
    try {
      if (existsSync(backupPath)) {
        if (existsSync(workspacePath)) {
          rmSync(workspacePath, { recursive: true, force: true });
        }
        cpSync(backupPath, workspacePath, { recursive: true });
        rmSync(backupPath, { recursive: true, force: true });
      }
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update pack" },
      { status: 500 }
    );
  }
}
