import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readTasks, addTask, CreateTaskSchema } from "@/lib/tasks";
import { logDashboardEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** GET /api/tasks — list all tasks */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await readTasks();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to read tasks:", err);
    return NextResponse.json(
      { error: "Failed to read tasks" },
      { status: 500 },
    );
  }
}

/** POST /api/tasks — create a new task */
export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid task data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const task = await addTask(parsed.data);
    await logDashboardEvent("tool.called", `User created task: ${task.title}`, {
      action: "task.created",
      taskId: task.id,
      priority: task.priority,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error("Failed to create task:", err);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 },
    );
  }
}
