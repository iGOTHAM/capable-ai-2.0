"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Minimize2, Maximize2, RefreshCw } from "lucide-react";
import { KanbanColumn } from "./kanban-column";
import { TaskModal } from "./task-modal";
import type { Task } from "@/lib/tasks";

interface TasksData {
  tasks: Task[];
  completed: Task[];
}

const COLUMNS = [
  { id: "pending" as const, label: "To Do", showAdd: true },
  { id: "in-progress" as const, label: "In Progress", showAdd: false },
  { id: "done" as const, label: "Done", showAdd: false },
  { id: "archived" as const, label: "Archive", showAdd: false },
];

export function KanbanBoard() {
  const [data, setData] = useState<TasksData>({ tasks: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kanban-collapsed") === "true";
    }
    return false;
  });
  const [archiveCollapsed, setArchiveCollapsed] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    // Poll for updates every 30s (agent may have changed tasks)
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // Persist collapse preference
  useEffect(() => {
    localStorage.setItem("kanban-collapsed", String(collapsed));
  }, [collapsed]);

  // Get tasks for a column
  const getColumnTasks = (status: Task["status"]) => {
    const allTasks = [...data.tasks, ...data.completed];
    return allTasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        // Sort by priority (high first), then by creation date
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      });
  };

  // Create task
  const handleCreate = async (taskData: {
    title: string;
    notes?: string;
    priority: "high" | "medium" | "low";
  }) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) throw new Error("Failed to create task");
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  // Update task
  const handleUpdate = async (taskData: {
    title: string;
    notes?: string;
    priority: "high" | "medium" | "low";
  }) => {
    if (!editingTask) return;
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) throw new Error("Failed to update task");
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  // Move task (change status)
  const handleMove = async (taskId: string, newStatus: Task["status"]) => {
    // Optimistic update
    setData((prev) => {
      const allTasks = [...prev.tasks, ...prev.completed];
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return prev;

      task.status = newStatus;
      const tasks = allTasks.filter(
        (t) => t.status !== "archived",
      );
      const completed = allTasks.filter(
        (t) => t.status === "archived",
      );
      return { tasks, completed };
    });

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to move task");
      // Re-fetch to ensure consistency
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task");
      await fetchTasks(); // Revert optimistic update
    }
  };

  // Delete task
  const handleDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  // Edit handler
  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  // Add handler
  const handleAdd = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Manage tasks for your AI agent. Both you and the agent can add and
            update tasks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="gap-1.5"
          >
            {collapsed ? (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                Expand
              </>
            ) : (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                Collapse
              </>
            )}
          </Button>
          <Button size="sm" onClick={handleAdd}>
            Add Task
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={getColumnTasks(col.id)}
            collapsed={col.id === "archived" ? archiveCollapsed : collapsed}
            showAdd={col.showAdd}
            onAddTask={col.showAdd ? handleAdd : undefined}
            onEditTask={handleEdit}
            onMoveTask={handleMove}
          />
        ))}
      </div>

      {/* Archive toggle */}
      {getColumnTasks("archived").length > 0 && (
        <button
          onClick={() => setArchiveCollapsed(!archiveCollapsed)}
          className="self-end text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {archiveCollapsed
            ? `Show ${getColumnTasks("archived").length} archived`
            : "Hide archive"}
        </button>
      )}

      {/* Task Modal */}
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        onSave={editingTask ? handleUpdate : handleCreate}
        onDelete={editingTask ? handleDelete : undefined}
      />
    </div>
  );
}
