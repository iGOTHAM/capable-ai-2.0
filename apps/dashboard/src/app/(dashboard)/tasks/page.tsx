"use client";

import { KanbanBoard } from "@/components/tasks/kanban-board";
import { LiveActivitySidebar } from "@/components/activity/live-activity-sidebar";

export default function TasksPage() {
  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0">
        <KanbanBoard />
      </div>
      <LiveActivitySidebar className="hidden xl:block w-[300px] shrink-0" />
    </div>
  );
}
