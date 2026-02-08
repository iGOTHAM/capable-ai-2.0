"use client";

import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Archive,
  Pencil,
} from "lucide-react";
import type { Task } from "@/lib/tasks";

const PRIORITY_DOT_COLORS: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-orange-500",
  low: "bg-gray-400",
};

const STATUS_ORDER = ["pending", "in-progress", "done", "archived"] as const;

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onMove: (taskId: string, newStatus: Task["status"]) => void;
}

export function TaskCard({ task, onEdit, onMove }: TaskCardProps) {
  const currentIndex = STATUS_ORDER.indexOf(task.status);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < STATUS_ORDER.length - 2;
  const canArchive = task.status !== "archived";

  return (
    <div className="group rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/30">
      {/* Title row with priority dot */}
      <div className="flex items-start gap-2">
        <div
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT_COLORS[task.priority] || "bg-gray-400"}`}
          title={`${task.priority} priority`}
        />
        <button
          onClick={() => onEdit(task)}
          className="flex-1 text-left text-sm font-medium leading-snug hover:text-primary transition-colors"
        >
          {task.title}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onEdit(task)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>

      {/* Notes preview */}
      {task.notes && (
        <p className="mt-1 pl-4 text-xs text-muted-foreground line-clamp-2">
          {task.notes}
        </p>
      )}

      {/* Move buttons — show on hover */}
      <div className="mt-2 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {canMoveLeft && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMove(task.id, STATUS_ORDER[currentIndex - 1]!)}
            title="Move left"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
        )}
        {canMoveRight && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMove(task.id, STATUS_ORDER[currentIndex + 1]!)}
            title="Move right"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
        {canArchive && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMove(task.id, "archived")}
            title="Archive"
          >
            <Archive className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
