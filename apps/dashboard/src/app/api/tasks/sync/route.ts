import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readTasks } from "@/lib/tasks";
import { writeDoc } from "@/lib/docs";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/sync
 *
 * Writes the current kanban tasks to TASKS.md in the workspace
 * so the OpenClaw agent can read them on its next run.
 */
export async function POST() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await readTasks();
    const allTasks = [...data.tasks, ...data.completed];

    // Group by status
    const pending = allTasks.filter((t) => t.status === "pending");
    const inProgress = allTasks.filter((t) => t.status === "in-progress");
    const done = allTasks.filter((t) => t.status === "done");

    // Build markdown
    const lines: string[] = [
      "# Task Board",
      "",
      "> This file is auto-synced from the dashboard task board.",
      "> Updated: " + new Date().toISOString(),
      "",
    ];

    const renderTasks = (tasks: typeof allTasks) => {
      if (tasks.length === 0) {
        lines.push("_No tasks_");
        lines.push("");
        return;
      }
      for (const t of tasks) {
        const priority =
          t.priority === "high"
            ? "🔴"
            : t.priority === "medium"
              ? "🟡"
              : "⚪";
        lines.push(`- ${priority} **${t.title}**`);
        if (t.notes) {
          lines.push(`  ${t.notes}`);
        }
      }
      lines.push("");
    };

    lines.push("## To Do");
    lines.push("");
    renderTasks(pending);

    lines.push("## In Progress");
    lines.push("");
    renderTasks(inProgress);

    lines.push("## Done");
    lines.push("");
    renderTasks(done);

    const markdown = lines.join("\n");

    // Write to workspace root as TASKS.md
    const written = await writeDoc("TASKS.md", markdown);
    if (!written) {
      // TASKS.md might be classified as system/read-only — force-write it
      // by using the docs lib directly with a non-system path
      // Actually TASKS.md is not in the SYSTEM_FILES set, so it should be editable
      return NextResponse.json(
        { error: "Failed to write TASKS.md" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      taskCount: pending.length + inProgress.length + done.length,
      message: `Synced ${pending.length + inProgress.length + done.length} tasks to TASKS.md`,
    });
  } catch (err) {
    console.error("Task sync failed:", err);
    return NextResponse.json(
      { error: "Failed to sync tasks" },
      { status: 500 },
    );
  }
}
