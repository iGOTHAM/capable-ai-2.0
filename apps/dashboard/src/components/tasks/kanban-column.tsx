"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/tasks";

const COLUMN_DOT_COLORS: Record<string, string> = {
  pending: "bg-blue-500",
  "in-progress": "bg-orange-500",
  done: "bg-green-500",
  archived: "bg-purple-500",
};

interface KanbanColumnProps {
  id: string;
  label: string;
  tasks: Task[];
  collapsed?: boolean;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: Task["status"]) => void;
}

export function KanbanColumn({
  id,
  label,
  tasks,
  collapsed = false,
  onAddTask,
  onEditTask,
  onMoveTask,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        "flex min-w-[260px] flex-col rounded-lg border bg-muted/30",
        id === "archived" && !collapsed && "bg-purple-500/5 border-purple-500/20",
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              COLUMN_DOT_COLORS[id] || "bg-gray-500",
            )}
          />
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground">
            {label}
          </h3>
          <span className="text-xs text-muted-foreground/60">
            ({tasks.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onAddTask}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Cards */}
      {!collapsed && (
        <ScrollArea className="flex-1 px-2 pb-2">
          <div className="flex flex-col gap-2">
            {tasks.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground/50">
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
          <p className="text-xs text-muted-foreground/50">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
