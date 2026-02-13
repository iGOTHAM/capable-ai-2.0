"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "./kanban-column";
import { TaskModal } from "./task-modal";
import { TaskStatsBar } from "./task-stats-bar";
import type { Task } from "@/lib/tasks";

interface TasksData {
  tasks: Task[];
  completed: Task[];
}

const COLUMNS = [
  { id: "pending" as const, label: "Backlog" },
  { id: "in-progress" as const, label: "In Progress" },
  { id: "done" as const, label: "Review" },
  { id: "archived" as const, label: "Archive" },
];

export function KanbanBoard() {
  const [data, setData] = useState<TasksData>({ tasks: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveCollapsed, setArchiveCollapsed] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addToStatus, setAddToStatus] = useState<Task["status"]>("pending");

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmBulkClear, setConfirmBulkClear] = useState(false);

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
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // Get tasks for a column
  const getColumnTasks = (status: Task["status"]) => {
    const allTasks = [...data.tasks, ...data.completed];
    return allTasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
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
    status?: Task["status"];
  }) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...taskData,
          status: taskData.status || addToStatus,
        }),
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

  // Move task
  const handleMove = async (taskId: string, newStatus: Task["status"]) => {
    setData((prev) => {
      const allTasks = [...prev.tasks, ...prev.completed];
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return prev;
      task.status = newStatus;
      const tasks = allTasks.filter((t) => t.status !== "archived");
      const completed = allTasks.filter((t) => t.status === "archived");
      return { tasks, completed };
    });

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to move task");
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task");
      await fetchTasks();
    }
  };

  // Delete task
  const handleDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  // Delete with confirmation (from card trash icon)
  const handleDeleteConfirm = (taskId: string) => {
    setConfirmDelete(taskId);
  };

  const executeDelete = async () => {
    if (confirmDelete) {
      await handleDelete(confirmDelete);
      setConfirmDelete(null);
    }
  };

  // Bulk clear archived tasks
  const handleBulkClearArchive = async () => {
    const archived = getColumnTasks("archived");
    try {
      await Promise.all(
        archived.map((t) =>
          fetch(`/api/tasks/${t.id}`, { method: "DELETE" }),
        ),
      );
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear archive");
    }
    setConfirmBulkClear(false);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleAdd = (status: Task["status"]) => {
    setEditingTask(null);
    setAddToStatus(status);
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
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats bar */}
      <TaskStatsBar tasks={data.tasks} completed={data.completed} />

      {/* Action row */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => handleAdd("pending")}
        >
          <Plus className="h-3 w-3" />
          New task
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={getColumnTasks(col.id)}
            collapsed={col.id === "archived" ? archiveCollapsed : false}
            onAddTask={() => handleAdd(col.id)}
            onEditTask={handleEdit}
            onMoveTask={handleMove}
            onDeleteTask={handleDeleteConfirm}
          />
        ))}
      </div>

      {/* Archive controls */}
      {getColumnTasks("archived").length > 0 && (
        <div className="flex items-center justify-end gap-3">
          {!archiveCollapsed && (
            <button
              onClick={() => setConfirmBulkClear(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear all archived
            </button>
          )}
          <button
            onClick={() => setArchiveCollapsed(!archiveCollapsed)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {archiveCollapsed
              ? `Show all ${getColumnTasks("archived").length} archived`
              : "Hide archive"}
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg border bg-card p-6 shadow-lg max-w-sm mx-4">
            <h3 className="text-sm font-semibold">Delete task?</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={executeDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk clear confirmation dialog */}
      {confirmBulkClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg border bg-card p-6 shadow-lg max-w-sm mx-4">
            <h3 className="text-sm font-semibold">Clear all archived tasks?</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              This will permanently delete {getColumnTasks("archived").length} archived task{getColumnTasks("archived").length !== 1 ? "s" : ""}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmBulkClear(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkClearArchive}
              >
                Clear all
              </Button>
            </div>
          </div>
        </div>
      )}

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        defaultStatus={addToStatus}
        onSave={editingTask ? handleUpdate : handleCreate}
        onDelete={editingTask ? handleDelete : undefined}
      />
    </div>
  );
}
