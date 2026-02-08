import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { updateTask, deleteTask, UpdateTaskSchema } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/** PATCH /api/tasks/[id] — update a task */
export async function PATCH(
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
    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const task = await updateTask(id, parsed.data);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (err) {
    console.error("Failed to update task:", err);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 },
    );
  }
}

/** DELETE /api/tasks/[id] — delete a task */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete task:", err);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}
