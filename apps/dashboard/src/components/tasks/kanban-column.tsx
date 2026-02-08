"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "./task-card";
import type { Task } from "@/lib/tasks";

const COLUMN_STYLES: Record<string, string> = {
  pending: "border-t-blue-500",
  "in-progress": "border-t-orange-500",
  done: "border-t-green-500",
  archived: "border-t-gray-500",
};

interface KanbanColumnProps {
  id: string;
  label: string;
  tasks: Task[];
  collapsed?: boolean;
  showAdd?: boolean;
  onAddTask?: () => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: Task["status"]) => void;
}

export function KanbanColumn({
  id,
  label,
  tasks,
  collapsed = false,
  showAdd = false,
  onAddTask,
  onEditTask,
  onMoveTask,
}: KanbanColumnProps) {
  return (
    <div
      className={`flex min-w-[280px] flex-col rounded-lg border border-t-2 bg-muted/30 ${COLUMN_STYLES[id] || ""}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{label}</h3>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {tasks.length}
          </Badge>
        </div>
        {showAdd && onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onAddTask}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Cards */}
      {!collapsed && (
        <ScrollArea className="flex-1 px-2 pb-2">
          <div className="flex flex-col gap-2">
            {tasks.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No tasks
              </p>
            )}
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onMove={onMoveTask}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {collapsed && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
