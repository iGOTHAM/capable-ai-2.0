"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/tasks";

const PRIORITIES = ["high", "medium", "low"] as const;

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  medium:
    "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  low: "border-gray-500 bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "To Do",
  "in-progress": "In Progress",
  done: "Done",
  archived: "Archive",
};

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultStatus?: Task["status"];
  onSave: (data: {
    title: string;
    notes?: string;
    priority: "high" | "medium" | "low";
    status?: Task["status"];
  }) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskModal({
  open,
  onOpenChange,
  task,
  defaultStatus = "pending",
  onSave,
  onDelete,
}: TaskModalProps) {
  const isEdit = !!task;
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || "");
      setPriority(task.priority);
    } else {
      setTitle("");
      setNotes("");
      setPriority("medium");
    }
  }, [task, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      notes: notes.trim() || undefined,
      priority,
      status: isEdit ? undefined : defaultStatus,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update task details below."
              : `Adding to: ${STATUS_LABELS[defaultStatus] || defaultStatus}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Title */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) handleSave();
              }}
              autoFocus
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-notes">Notes (optional)</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context or details..."
              rows={3}
            />
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-2">
            <Label>Priority</Label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    priority === p
                      ? PRIORITY_STYLES[p]
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Edit mode: meta info */}
          {isEdit && task && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                {task.status}
              </Badge>
              {task.createdBy && (
                <span>Created by {task.createdBy}</span>
              )}
              <span>
                {new Date(task.created).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {isEdit && task && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(task.id);
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!title.trim()}>
              {isEdit ? "Save" : "Add"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
