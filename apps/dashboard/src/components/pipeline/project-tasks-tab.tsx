"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, CheckCircle2, Circle, Clock, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  notes?: string;
}

interface ProjectTasksTabProps {
  projectName: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "To Do", className: "bg-blue-500/10 text-blue-500" },
  "in-progress": { label: "In Progress", className: "bg-orange-500/10 text-orange-500" },
  done: { label: "Done", className: "bg-green-500/10 text-green-500" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground" },
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-orange-400",
  low: "bg-muted-foreground/40",
};

export function ProjectTasksTab({ projectName }: ProjectTasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const fetchTasks = () => {
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : { tasks: [], completed: [] }))
      .then((data) => {
        const allTasks = [...(data.tasks || []), ...(data.completed || [])];
        const filtered = allTasks.filter(
          (t: Task) =>
            t.title.toLowerCase().includes(projectName.toLowerCase()) ||
            (t.notes || "").toLowerCase().includes(projectName.toLowerCase()),
        );
        setTasks(filtered);
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
  }, [projectName]);

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          notes: `Project: ${projectName}`,
          priority: "medium",
        }),
      });
      setNewTitle("");
      setAdding(false);
      setLoading(true);
      fetchTasks();
    } catch {
      // Silent fail
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setLoading(true);
      fetchTasks();
    } catch {
      // Silent fail
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add task */}
      <div className="flex justify-end">
        {adding ? (
          <div className="flex w-full items-center gap-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTask();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Task title..."
              className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={handleAddTask}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Add Task
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground opacity-30" />
          <div className="text-center">
            <p className="text-sm font-medium">No tasks reference this project</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a task to track work for {projectName}.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          {tasks.map((task, i) => {
            const badge = STATUS_BADGE[task.status] ?? { label: task.status, className: "bg-muted text-muted-foreground" };
            const priorityDot = PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium;
            const isDone = task.status === "done" || task.status === "archived";

            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-border",
                )}
              >
                <button
                  onClick={() =>
                    handleStatusChange(task.id, isDone ? "pending" : "done")
                  }
                  className="shrink-0"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <div
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    priorityDot,
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm",
                      isDone && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </p>
                  {task.notes && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {task.notes}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
