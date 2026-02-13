"use client";

import { KanbanBoard } from "@/components/tasks/kanban-board";
import { LiveActivitySidebar } from "@/components/activity/live-activity-sidebar";
import { PageHint } from "@/components/ui/page-hint";
import { ListTodo } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHint
        id="hint-tasks"
        title="Your Agent's Task Board"
        description="Create tasks here and your agent will pick them up. Drag to reorder, click to edit. Your agent can also create its own tasks."
        icon={ListTodo}
      />
      <div className="flex gap-5">
        <div className="flex-1 min-w-0">
          <KanbanBoard />
        </div>
        <LiveActivitySidebar className="hidden xl:block w-[300px] shrink-0" />
      </div>
    </div>
  );
}
