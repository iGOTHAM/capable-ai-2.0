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
import type { ScheduledTask } from "@/app/(dashboard)/calendar/page";

const COLORS = [
  { id: "blue", label: "Blue", class: "bg-blue-600" },
  { id: "green", label: "Green", class: "bg-green-600" },
  { id: "orange", label: "Orange", class: "bg-orange-600" },
  { id: "red", label: "Red", class: "bg-red-600" },
  { id: "purple", label: "Purple", class: "bg-purple-600" },
  { id: "yellow", label: "Yellow", class: "bg-yellow-600" },
] as const;

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type ScheduleColor = ScheduledTask["color"];

interface ScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ScheduledTask | null;
  onSave: (data: Omit<ScheduledTask, "id" | "createdAt">) => Promise<void>;
  onUpdate?: (id: string, data: Partial<ScheduledTask>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function ScheduleModal({
  open,
  onOpenChange,
  task,
  onSave,
  onUpdate,
  onDelete,
}: ScheduleModalProps) {
  const isEdit = !!task;

  const [name, setName] = useState("");
  const [type, setType] = useState<"recurring" | "always-running">("recurring");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [time, setTime] = useState("09:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [color, setColor] = useState<ScheduleColor>("blue");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (task) {
      setName(task.name);
      setType(task.type);
      setColor(task.color);
      setEnabled(task.enabled);
      if (task.type === "recurring") {
        setFrequency(task.schedule.frequency === "weekly" ? "weekly" : "daily");
        setTime(task.schedule.time || "09:00");
        setDays(task.schedule.days || [1, 2, 3, 4, 5]);
      } else {
        setIntervalMinutes(task.schedule.intervalMinutes || 30);
      }
    } else {
      setName("");
      setType("recurring");
      setFrequency("daily");
      setTime("09:00");
      setDays([1, 2, 3, 4, 5]);
      setIntervalMinutes(30);
      setColor("blue");
      setEnabled(true);
    }
  }, [task, open]);

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const schedule =
      type === "recurring"
        ? {
            frequency: frequency as "daily" | "weekly",
            time,
            days: frequency === "weekly" ? days : [0, 1, 2, 3, 4, 5, 6],
          }
        : {
            frequency: "interval" as const,
            intervalMinutes,
          };

    const data = {
      name: name.trim(),
      type,
      color,
      schedule,
      enabled,
    };

    if (isEdit && task && onUpdate) {
      await onUpdate(task.id, data);
    } else {
      await onSave(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Schedule" : "New Scheduled Task"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this scheduled task."
              : "Create an automated routine for your agent."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-name">Name</Label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Briefing, Content Review"
              autoFocus
            />
          </div>

          {/* Type toggle */}
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <div className="flex rounded-lg border border-border">
              <button
                onClick={() => setType("recurring")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors rounded-l-lg ${
                  type === "recurring"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Recurring
              </button>
              <button
                onClick={() => setType("always-running")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors rounded-r-lg ${
                  type === "always-running"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Always Running
              </button>
            </div>
          </div>

          {/* Recurring options */}
          {type === "recurring" && (
            <>
              {/* Frequency */}
              <div className="flex flex-col gap-2">
                <Label>Frequency</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFrequency("daily")}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      frequency === "daily"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setFrequency("weekly")}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      frequency === "weekly"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    Weekly
                  </button>
                </div>
              </div>

              {/* Time */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="schedule-time">Time</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-32"
                />
              </div>

              {/* Days of week (for weekly) */}
              {frequency === "weekly" && (
                <div className="flex flex-col gap-2">
                  <Label>Days</Label>
                  <div className="flex gap-1">
                    {DAYS.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          days.includes(day.value)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Always-running options */}
          {type === "always-running" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-interval">
                Interval (minutes)
              </Label>
              <Input
                id="schedule-interval"
                type="number"
                min={1}
                max={1440}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Agent will run every {intervalMinutes} minute
                {intervalMinutes !== 1 ? "s" : ""}.
              </p>
            </div>
          )}

          {/* Color picker */}
          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id as ScheduleColor)}
                  className={`h-7 w-7 rounded-full transition-all ${c.class} ${
                    color === c.id
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "opacity-50 hover:opacity-75"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <Label className="cursor-pointer" onClick={() => setEnabled(!enabled)}>
              {enabled ? "Enabled" : "Disabled"}
            </Label>
          </div>
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
            <Button onClick={handleSave} disabled={!name.trim()}>
              {isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
