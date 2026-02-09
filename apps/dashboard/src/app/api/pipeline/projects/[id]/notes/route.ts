import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getProjectNotes, addNote } from "@/lib/pipeline";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateNoteSchema = z.object({
  text: z.string().min(1).max(5000),
  author: z.string().min(1).max(100),
});

/**
 * GET /api/pipeline/projects/[id]/notes
 * Returns all notes for a project.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const notes = await getProjectNotes(id);
    return NextResponse.json({ notes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/pipeline/projects/[id]/notes
 * Add a note to a project.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const input = CreateNoteSchema.parse(body);
    const note = await addNote(id, input);
    if (!note) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.errors },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to add note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
