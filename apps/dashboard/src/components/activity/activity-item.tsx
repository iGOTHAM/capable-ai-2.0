"use client";

import {
  Play,
  CheckCircle2,
  Wrench,
  Lightbulb,
  AlertTriangle,
  Shield,
  XCircle,
  MessageCircle,
  Bot,
  Rocket,
  Brain,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityEvent {
  ts: string;
  runId: string;
  type: string;
  summary: string;
  risk?: string;
}

const typeConfig: Record<
  string,
  { icon: LucideIcon; color: string; bgColor: string; label: string }
> = {
  "run.started": {
    icon: Play,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    label: "Run Started",
  },
  "run.finished": {
    icon: CheckCircle2,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    label: "Run Finished",
  },
  "plan.created": {
    icon: Lightbulb,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    label: "Plan Created",
  },
  "tool.called": {
    icon: Wrench,
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    label: "Tool Execution",
  },
  "tool.result": {
    icon: Wrench,
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    label: "Tool Result",
  },
  "approval.requested": {
    icon: AlertTriangle,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    label: "Approval Requested",
  },
  "approval.resolved": {
    icon: CheckCircle2,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    label: "Approval Resolved",
  },
  "memory.write": {
    icon: Brain,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    label: "Memory Write",
  },
  "security.warning": {
    icon: Shield,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    label: "Security Warning",
  },
  error: {
    icon: XCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    label: "Error",
  },
  "chat.user_message": {
    icon: MessageCircle,
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    label: "Chat Message",
  },
  "chat.bot_message": {
    icon: Bot,
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    label: "Chat Message",
  },
  "bootstrap.completed": {
    icon: Rocket,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    label: "Bootstrap Completed",
  },
};

const defaultConfig = {
  icon: Wrench,
  color: "text-zinc-400",
  bgColor: "bg-zinc-500/10",
  label: "Event",
};

interface ActivityItemProps {
  event: ActivityEvent;
}

export function ActivityItem({ event }: ActivityItemProps) {
  const config = typeConfig[event.type] || defaultConfig;
  const Icon = config.icon;
  const time = new Date(event.ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          config.bgColor,
        )}
      >
        <Icon className={cn("h-[18px] w-[18px]", config.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {config.label}
        </div>
        <p className="mt-1 text-sm leading-relaxed">{event.summary}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{time}</span>
          {event.risk && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
              {event.risk}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
