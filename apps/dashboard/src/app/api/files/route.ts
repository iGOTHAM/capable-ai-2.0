import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const WORKSPACE = process.env.OPENCLAW_DIR || "/root/.openclaw";
const UPLOADS_DIR = path.join(WORKSPACE, "workspace", "uploads");
const DEALS_DIR = path.join(WORKSPACE, "workspace", "deals");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".txt", ".md", ".csv", ".json", ".xlsx",
  ".doc", ".docx", ".xls",
  ".jpg", ".jpeg", ".png", ".webp", ".gif",
]);

/** GET /api/files — list all uploaded files and deal files */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const uploads = await listDir(UPLOADS_DIR, "uploads");
    const deals = await listDeals();

    return NextResponse.json({ uploads, deals });
  } catch {
    return NextResponse.json({ uploads: [], deals: [] });
  }
}

/** POST /api/files — upload a file to workspace/uploads/ */
export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate extension
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type ${ext} not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}` },
        { status: 400 },
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB per file.` },
        { status: 400 },
      );
    }

    // Check total size
    const currentTotal = await getTotalSize(UPLOADS_DIR);
    if (currentTotal + file.size > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: `Upload would exceed ${MAX_TOTAL_SIZE / 1024 / 1024}MB total storage limit.` },
        { status: 400 },
      );
    }

    // Sanitize filename — remove path traversal, keep safe chars
    const safeName = sanitizeFilename(file.name);
    if (!safeName) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Ensure uploads dir exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(UPLOADS_DIR, safeName);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      file: {
        name: safeName,
        size: file.size,
        type: file.type,
      },
    });
  } catch (err) {
    console.error("File upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  // Remove path components
  const basename = path.basename(name);
  // Replace unsafe characters
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Prevent dotfiles
  if (safe.startsWith(".")) return "";
  // Prevent empty
  if (!safe || safe === "_") return "";
  return safe;
}

interface FileInfo {
  name: string;
  size: number;
  modified: string;
  path: string;
}

async function listDir(dirPath: string, prefix: string): Promise<FileInfo[]> {
  try {
    const entries = await fs.readdir(dirPath);
    const files: FileInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        files.push({
          name: entry,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          path: `${prefix}/${entry}`,
        });
      }
    }

    return files.sort((a, b) => b.modified.localeCompare(a.modified));
  } catch {
    return [];
  }
}

interface DealFolder {
  name: string;
  files: FileInfo[];
}

async function listDeals(): Promise<DealFolder[]> {
  try {
    const entries = await fs.readdir(DEALS_DIR);
    const deals: DealFolder[] = [];

    for (const entry of entries) {
      const dealPath = path.join(DEALS_DIR, entry);
      const stat = await fs.stat(dealPath);
      if (stat.isDirectory()) {
        const files = await listDir(dealPath, `deals/${entry}`);
        deals.push({ name: entry, files });
      }
    }

    return deals;
  } catch {
    return [];
  }
}

async function getTotalSize(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath);
    let total = 0;
    for (const entry of entries) {
      const stat = await fs.stat(path.join(dirPath, entry));
      if (stat.isFile()) total += stat.size;
    }
    return total;
  } catch {
    return 0;
  }
}
