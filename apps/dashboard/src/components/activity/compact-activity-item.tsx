"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Event {
  ts: string;
  runId: string;
  type: string;
  summary: string;
  risk?: string;
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `about ${hours} hour${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function getEventUser(_type: string): string {
  // In the future, distinguish between human and AI events
  return "henry";
}

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "run.started": { label: "Run Started", color: "bg-blue-500/10 text-blue-400" },
  "run.finished": { label: "Run Finished", color: "bg-green-500/10 text-green-400" },
  "plan.created": { label: "Plan", color: "bg-violet-500/10 text-violet-400" },
  "tool.called": { label: "Tool Call", color: "bg-zinc-500/10 text-zinc-400" },
  "tool.result": { label: "Tool Result", color: "bg-zinc-500/10 text-zinc-400" },
  "approval.requested": { label: "Approval", color: "bg-amber-500/10 text-amber-400" },
  "approval.resolved": { label: "Resolved", color: "bg-green-500/10 text-green-400" },
  "memory.write": { label: "Memory", color: "bg-cyan-500/10 text-cyan-400" },
  "security.warning": { label: "Security", color: "bg-red-500/10 text-red-400" },
  "error": { label: "Error", color: "bg-red-500/10 text-red-400" },
  "chat.user_message": { label: "Chat", color: "bg-zinc-500/10 text-zinc-400" },
  "chat.bot_message": { label: "Chat", color: "bg-zinc-500/10 text-zinc-400" },
  "bootstrap.completed": { label: "Bootstrap", color: "bg-emerald-500/10 text-emerald-400" },
};

export function CompactActivityItem({ event }: { event: Event }) {
  const [expanded, setExpanded] = useState(false);
  const user = getEventUser(event.type);
  const typeInfo = EVENT_TYPE_LABELS[event.type];

  return (
    <div
      onClick={() => setExpanded((prev) => !prev)}
      className={cn(
        "flex cursor-pointer flex-col gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-2.5 transition-colors hover:bg-card/80",
        expanded && "bg-card/80"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px] shadow-green-500/50" />
          <span className="text-xs font-medium text-green-400">{user}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatTimeAgo(event.ts)}
        </span>
      </div>
      <p className={cn(
        "text-xs leading-relaxed text-muted-foreground",
        !expanded && "line-clamp-2"
      )}>
        {event.summary}
      </p>
      {expanded && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {typeInfo && (
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", typeInfo.color)}>
              {typeInfo.label}
            </span>
          )}
          {event.risk && (
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              event.risk === "high" || event.risk === "critical"
                ? "bg-red-500/10 text-red-400"
                : event.risk === "medium"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-green-500/10 text-green-400"
            )}>
              {event.risk} risk
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(event.ts).toLocaleString()} · {event.runId}
          </span>
        </div>
      )}
    </div>
  );
}
