import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const WORKSPACE = process.env.OPENCLAW_DIR || "/root/.openclaw";
const UPLOADS_DIR = path.join(WORKSPACE, "workspace", "uploads");

/** GET /api/files/[filename] — download/preview a file */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;
  const safeName = path.basename(filename);

  // Prevent path traversal
  if (safeName !== filename || safeName.startsWith(".")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(UPLOADS_DIR, safeName);

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(safeName).toLowerCase();

    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".csv": "text/csv",
      ".json": "application/json",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
    };

    return new NextResponse(content, {
      headers: {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

/** DELETE /api/files/[filename] — delete an uploaded file */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;
  const safeName = path.basename(filename);

  if (safeName !== filename || safeName.startsWith(".")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(UPLOADS_DIR, safeName);

  try {
    await fs.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
