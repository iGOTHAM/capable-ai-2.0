"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  Play,
  CheckCircle2,
  Lightbulb,
  Wrench,
  AlertTriangle,
  Brain,
  Shield,
  XCircle,
  MessageCircle,
  Bot,
  Rocket,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Event {
  ts: string;
  runId: string;
  type: string;
  summary: string;
  risk?: string;
}

interface ProjectActivityTabProps {
  projectName: string;
}

const EVENT_STYLES: Record<
  string,
  { icon: React.ElementType; bg: string; text: string }
> = {
  "run.started": { icon: Play, bg: "bg-blue-500/10", text: "text-blue-500" },
  "run.finished": { icon: CheckCircle2, bg: "bg-green-500/10", text: "text-green-500" },
  "plan.created": { icon: Lightbulb, bg: "bg-violet-500/10", text: "text-violet-500" },
  "tool.called": { icon: Wrench, bg: "bg-zinc-500/10", text: "text-zinc-400" },
  "tool.result": { icon: Wrench, bg: "bg-zinc-500/10", text: "text-zinc-400" },
  "approval.requested": { icon: AlertTriangle, bg: "bg-amber-500/10", text: "text-amber-500" },
  "approval.resolved": { icon: CheckCircle2, bg: "bg-green-500/10", text: "text-green-500" },
  "memory.write": { icon: Brain, bg: "bg-cyan-500/10", text: "text-cyan-500" },
  "security.warning": { icon: Shield, bg: "bg-red-500/10", text: "text-red-500" },
  error: { icon: XCircle, bg: "bg-red-500/10", text: "text-red-500" },
  "chat.user_message": { icon: MessageCircle, bg: "bg-zinc-500/10", text: "text-zinc-400" },
  "chat.bot_message": { icon: Bot, bg: "bg-zinc-500/10", text: "text-zinc-400" },
  "bootstrap.completed": { icon: Rocket, bg: "bg-emerald-500/10", text: "text-emerald-500" },
};

function formatDate(ts: string): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ProjectActivityTab({ projectName }: ProjectActivityTabProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = projectName.toLowerCase();
    return events
      .filter((e) => e.summary.toLowerCase().includes(q))
      .slice(-50)
      .reverse();
  }, [events, projectName]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { date: string; events: Event[] }[] = [];
    let currentDate = "";

    for (const event of filtered) {
      const date = formatDate(event.ts);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, events: [] });
      }
      groups[groups.length - 1]!.events.push(event);
    }

    return groups;
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16">
        <Activity className="h-10 w-10 text-muted-foreground opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Agent activity related to {projectName} will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map((group) => (
        <div key={group.date}>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.date}
          </div>
          <div className="flex flex-col gap-2">
            {group.events.map((event, i) => {
              const style = EVENT_STYLES[event.type] || {
                icon: Activity,
                bg: "bg-muted",
                text: "text-muted-foreground",
              };
              const Icon = style.icon;
              const time = new Date(event.ts).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={`${event.ts}-${i}`}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      style.bg,
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", style.text)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed">{event.summary}</p>
                    {event.risk && (
                      <span className="mt-1 inline-block rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">
                        {event.risk}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {time}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
