import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { listDocs, writeDoc, createFolder } from "@/lib/docs";

export const dynamic = "force-dynamic";

/** GET /api/docs — list all workspace documents as folder tree */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tree = await listDocs();
    return NextResponse.json({ docs: tree });
  } catch (err) {
    console.error("Failed to list docs:", err);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 },
    );
  }
}

/** POST /api/docs — create a new document or folder */
export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { path: docPath, content, type } = body as {
      path?: string;
      content?: string;
      type?: "file" | "folder";
    };

    if (!docPath || typeof docPath !== "string") {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 },
      );
    }

    // Prevent dangerous paths
    if (docPath.includes("..") || docPath.startsWith("/")) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 },
      );
    }

    if (type === "folder") {
      const created = await createFolder(docPath);
      if (!created) {
        return NextResponse.json(
          { error: "Failed to create folder" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, path: docPath }, { status: 201 });
    }

    // Default: create file
    const written = await writeDoc(docPath, content || "");
    if (!written) {
      return NextResponse.json(
        { error: "Cannot create file at this path (may be read-only)" },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, path: docPath }, { status: 201 });
  } catch (err) {
    console.error("Failed to create doc:", err);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 },
    );
  }
}
