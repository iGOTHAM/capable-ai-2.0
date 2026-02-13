import { NextRequest, NextResponse } from "next/server";
import {
  readSchedules,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
} from "@/lib/schedules";
import { verifyAuth } from "@/lib/auth";
import { logDashboardEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await readSchedules();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const task = await createScheduledTask(body);
    await logDashboardEvent("tool.called", `User created schedule: ${task.name}`, {
      action: "schedule.created",
      scheduleId: task.id,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 400 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const task = await updateScheduledTask(id, updates);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const action = updates.enabled !== undefined && Object.keys(updates).length === 1
      ? `User ${task.enabled ? "enabled" : "disabled"} schedule: ${task.name}`
      : `User updated schedule: ${task.name}`;
    await logDashboardEvent("tool.called", action, {
      action: "schedule.updated",
      scheduleId: id,
    });
    return NextResponse.json(task);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const deleted = await deleteScheduledTask(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await logDashboardEvent("tool.called", `User deleted schedule: ${id}`, {
      action: "schedule.deleted",
      scheduleId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 400 },
    );
  }
}
