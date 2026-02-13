"use client";

import type { Task } from "@/lib/tasks";

interface TaskStatsBarProps {
  tasks: Task[];
  completed: Task[];
}

export function TaskStatsBar({ tasks, completed }: TaskStatsBarProps) {
  const allTasks = [...tasks, ...completed];
  const total = allTasks.length;
  const inProgress = allTasks.filter((t) => t.status === "in-progress").length;
  const done = allTasks.filter(
    (t) => t.status === "done" || t.status === "archived",
  ).length;

  // Tasks created this week
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = allTasks.filter(
    (t) => new Date(t.created).getTime() >= weekAgo,
  ).length;

  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    { value: thisWeek, label: "This week", color: "text-green-400" },
    { value: inProgress, label: "In progress", color: "text-orange-400" },
    { value: total, label: "Total", color: "text-foreground" },
    {
      value: `${completionPct}%`,
      label: "Completion",
      color: "text-primary",
    },
  ];

  return (
    <div className="flex items-center gap-6 px-1">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-bold ${stat.color}`}>
            {stat.value}
          </span>
          <span className="text-xs text-muted-foreground">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
