"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Archive,
  Pencil,
  Bot,
  User,
} from "lucide-react";
import type { Task } from "@/lib/tasks";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  medium:
    "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
  low: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20",
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
  const canMoveRight = currentIndex < STATUS_ORDER.length - 2; // Don't auto-move to archived
  const canArchive = task.status !== "archived";

  return (
    <div className="group rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/30">
      {/* Header: title + edit */}
      <div className="flex items-start justify-between gap-2">
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
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {task.notes}
        </p>
      )}

      {/* Footer: priority + created-by + move actions */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[task.priority] || ""}`}
          >
            {task.priority}
          </Badge>
          {task.createdBy && (
            <span className="text-muted-foreground" title={`Created by ${task.createdBy}`}>
              {task.createdBy === "agent" ? (
                <Bot className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
            </span>
          )}
        </div>

        {/* Move buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  );
}
