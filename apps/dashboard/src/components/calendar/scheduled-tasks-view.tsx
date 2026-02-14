"use client";

import { useState } from "react";
import { Zap, RefreshCw } from "lucide-react";
import { WeekGrid } from "./week-grid";
import { NextUpList } from "./next-up-list";
import type { ScheduledTask } from "@/app/(dashboard)/calendar/page";

const TASK_COLORS: Record<string, string> = {
  blue: "bg-blue-600 text-blue-100",
  green: "bg-green-600 text-green-100",
  orange: "bg-orange-600 text-orange-100",
  red: "bg-red-600 text-red-100",
  purple: "bg-purple-600 text-purple-100",
  yellow: "bg-yellow-600 text-yellow-100",
};

interface ScheduledTasksViewProps {
  tasks: ScheduledTask[];
  onRefresh: () => Promise<void>;
}

export function ScheduledTasksView({
  tasks,
  onRefresh,
}: ScheduledTasksViewProps) {
  const [view, setView] = useState<"week" | "today">("week");

  const alwaysRunning = tasks.filter((t) => t.type === "always-running");
  const recurring = tasks.filter((t) => t.type === "recurring");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Scheduled Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Your agent&apos;s automated routines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border">
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-l-lg ${
                view === "week"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("today")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-r-lg ${
                view === "today"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
          </div>
          <button
            onClick={onRefresh}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Always Running Section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-green-400" />
          <h2 className="text-sm font-semibold">Always Running</h2>
        </div>
        {alwaysRunning.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No always-running tasks configured
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {alwaysRunning.map((task) => (
              <div
                key={task.id}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  TASK_COLORS[task.color] || TASK_COLORS.blue
                }`}
              >
                {task.name} &middot; Every {task.schedule.intervalMinutes} min
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Grid */}
      <WeekGrid tasks={recurring} view={view} />

      {/* Next Up */}
      <NextUpList tasks={tasks} />

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-12">
          <p className="text-sm text-muted-foreground">
            No scheduled tasks yet. Schedules are created automatically when skills are installed.
          </p>
        </div>
      )}
    </div>
  );
}
