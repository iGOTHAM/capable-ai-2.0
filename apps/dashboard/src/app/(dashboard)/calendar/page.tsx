"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Clock } from "lucide-react";
import { ScheduledTasksView } from "@/components/calendar/scheduled-tasks-view";
import { PageHint } from "@/components/ui/page-hint";

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHint
        id="hint-calendar"
        title="Scheduled Routines"
        description="Your agent's automated routines and scheduled tasks. Schedules are managed through skills and the agent itself."
        icon={Clock}
      />
      <ScheduledTasksView
        tasks={tasks}
        onRefresh={fetchSchedules}
      />
    </div>
  );
}
