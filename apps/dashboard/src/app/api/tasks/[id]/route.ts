import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readTasks, updateTask, deleteTask, UpdateTaskSchema } from "@/lib/tasks";
import { logDashboardEvent } from "@/lib/events";

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

    // Read task before update for event logging
    const data = await readTasks();
    const allTasks = [...data.tasks, ...data.completed];
    const oldTask = allTasks.find((t) => t.id === id);

    const task = await updateTask(id, parsed.data);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Log the event
    if (parsed.data.status && oldTask && parsed.data.status !== oldTask.status) {
      await logDashboardEvent("tool.called", `User moved task "${task.title}" to ${parsed.data.status}`, {
        action: "task.moved",
        taskId: id,
        from: oldTask.status,
        to: parsed.data.status,
      });
    } else {
      await logDashboardEvent("tool.called", `User updated task: ${task.title}`, {
        action: "task.updated",
        taskId: id,
      });
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

    // Read task before delete for event logging
    const data = await readTasks();
    const allTasks = [...data.tasks, ...data.completed];
    const task = allTasks.find((t) => t.id === id);

    const deleted = await deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await logDashboardEvent("tool.called", `User deleted task: ${task?.title || id}`, {
      action: "task.deleted",
      taskId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete task:", err);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}
