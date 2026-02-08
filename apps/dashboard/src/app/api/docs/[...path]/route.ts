import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readDoc, writeDoc, deleteDoc } from "@/lib/docs";

export const dynamic = "force-dynamic";

/** GET /api/docs/[...path] — read a document's content */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join("/");

    // Prevent path traversal
    if (relativePath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const doc = await readDoc(relativePath);
    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      path: relativePath,
      content: doc.content,
      size: doc.size,
      modified: doc.modified,
    });
  } catch (err) {
    console.error("Failed to read doc:", err);
    return NextResponse.json(
      { error: "Failed to read document" },
      { status: 500 },
    );
  }
}

/** PUT /api/docs/[...path] — update a document's content */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join("/");

    if (relativePath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body as { content?: string };

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const written = await writeDoc(relativePath, content);
    if (!written) {
      return NextResponse.json(
        { error: "Cannot write to this path (may be read-only)" },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, path: relativePath });
  } catch (err) {
    console.error("Failed to write doc:", err);
    return NextResponse.json(
      { error: "Failed to write document" },
      { status: 500 },
    );
  }
}

/** DELETE /api/docs/[...path] — delete a document */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join("/");

    if (relativePath.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const deleted = await deleteDoc(relativePath);
    if (!deleted) {
      return NextResponse.json(
        { error: "Cannot delete (not found, not empty, or read-only)" },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete doc:", err);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
