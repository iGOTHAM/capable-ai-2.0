"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { ScheduledTasksView } from "@/components/calendar/scheduled-tasks-view";

export interface ScheduledTask {
  id: string;
  name: string;
  color: "blue" | "green" | "orange" | "red" | "purple" | "yellow";
  type: "recurring" | "always-running";
  schedule: {
    frequency: "daily" | "weekly" | "interval";
    time?: string;
    days?: number[];
    intervalMinutes?: number;
  };
  enabled: boolean;
  lastRun?: string;
  createdAt: string;
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/schedules");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleCreate = async (task: Omit<ScheduledTask, "id" | "createdAt">) => {
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      if (res.ok) {
        await fetchSchedules();
      }
    } catch {
      // ignore
    }
  };

  const handleUpdate = async (id: string, data: Partial<ScheduledTask>) => {
    try {
      await fetch("/api/schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      await fetchSchedules();
    } catch {
      // ignore
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch("/api/schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      await fetchSchedules();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
      await fetchSchedules();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScheduledTasksView
      tasks={tasks}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onToggle={handleToggle}
      onDelete={handleDelete}
      onRefresh={fetchSchedules}
    />
  );
}
