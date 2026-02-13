"use client";

import { Calendar } from "lucide-react";
import type { ScheduledTask } from "@/app/(dashboard)/calendar/page";

const TASK_TEXT_COLORS: Record<string, string> = {
  blue: "text-blue-400",
  green: "text-green-400",
  orange: "text-orange-400",
  red: "text-red-400",
  purple: "text-purple-400",
  yellow: "text-yellow-400",
};

function getNextRun(task: ScheduledTask): Date | null {
  if (!task.enabled) return null;
  const now = new Date();

  if (task.type === "always-running" && task.schedule.intervalMinutes) {
    if (task.lastRun) {
      const last = new Date(task.lastRun);
      return new Date(last.getTime() + task.schedule.intervalMinutes * 60000);
    }
    return now;
  }

  if (task.schedule.frequency === "daily" && task.schedule.time) {
    const [h, m] = task.schedule.time.split(":").map(Number);
    const next = new Date(now);
    next.setHours(h!, m!, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  if (
    task.schedule.frequency === "weekly" &&
    task.schedule.time &&
    task.schedule.days?.length
  ) {
    const [h, m] = task.schedule.time.split(":").map(Number);
    for (let offset = 0; offset < 8; offset++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(h!, m!, 0, 0);
      if (
        task.schedule.days.includes(candidate.getDay()) &&
        candidate > now
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function formatTimeUntil(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff < 0) return "now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `In ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `In ${hours} hour${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `In ${days} day${days !== 1 ? "s" : ""}`;
}

interface NextUpListProps {
  tasks: ScheduledTask[];
}

export function NextUpList({ tasks }: NextUpListProps) {
  const upcoming = tasks
    .map((task) => ({ task, nextRun: getNextRun(task) }))
    .filter(
      (entry): entry is { task: ScheduledTask; nextRun: Date } =>
        entry.nextRun !== null,
    )
    .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
    .slice(0, 10);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Next Up</h2>
      </div>
      <div className="flex flex-col">
        {upcoming.map(({ task, nextRun }) => (
          <div
            key={task.id}
            className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
          >
            <span
              className={`text-sm font-medium ${
                TASK_TEXT_COLORS[task.color] || "text-foreground"
              }`}
            >
              {task.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTimeUntil(nextRun)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
