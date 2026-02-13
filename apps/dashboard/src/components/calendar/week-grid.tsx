"use client";

import type { ScheduledTask } from "@/app/(dashboard)/calendar/page";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TASK_COLORS: Record<string, string> = {
  blue: "bg-blue-900/60 text-blue-300 border-blue-700/50",
  green: "bg-green-900/60 text-green-300 border-green-700/50",
  orange: "bg-orange-900/60 text-orange-300 border-orange-700/50",
  red: "bg-red-900/60 text-red-300 border-red-700/50",
  purple: "bg-purple-900/60 text-purple-300 border-purple-700/50",
  yellow: "bg-yellow-900/60 text-yellow-300 border-yellow-700/50",
};

interface WeekGridProps {
  tasks: ScheduledTask[];
  view: "week" | "today";
}

export function WeekGrid({ tasks, view }: WeekGridProps) {
  const today = new Date().getDay();

  // For "today" view, only show today's column
  const daysToShow =
    view === "today" ? [today] : [0, 1, 2, 3, 4, 5, 6];

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${daysToShow.length}, minmax(0, 1fr))`,
      }}
    >
      {daysToShow.map((dayIdx) => {
        const isToday = dayIdx === today;
        // Get tasks that run on this day
        const dayTasks = tasks.filter((t) => {
          if (t.schedule.frequency === "daily") return true;
          if (t.schedule.frequency === "weekly" && t.schedule.days) {
            return t.schedule.days.includes(dayIdx);
          }
          return false;
        });

        return (
          <div
            key={dayIdx}
            className={`rounded-xl border p-3 min-h-[200px] ${
              isToday
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card/50"
            }`}
          >
            <div
              className={`mb-3 text-xs font-semibold ${
                isToday ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {DAY_NAMES[dayIdx]}
            </div>
            <div className="flex flex-col gap-1.5">
              {dayTasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium truncate ${
                    TASK_COLORS[task.color] || TASK_COLORS.blue
                  }`}
                >
                  <div className="truncate">{task.name}</div>
                  {task.schedule.time && (
                    <div className="mt-0.5 text-[10px] opacity-70">
                      {task.schedule.time}
                    </div>
                  )}
                </div>
              ))}
              {dayTasks.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-4">
                  No tasks
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
