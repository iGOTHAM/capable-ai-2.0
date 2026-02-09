"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentStatus = "running" | "stopped" | "pending";

interface AgentInfo {
  name: string;
  status: AgentStatus;
  emoji: string;
}

export function AgentPanel() {
  const router = useRouter();
  const [info, setInfo] = useState<AgentInfo>({
    name: "Atlas",
    status: "stopped",
    emoji: "🤖",
  });

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-info");
      if (res.ok) {
        const data = await res.json();
        setInfo({
          name: data.name || "Atlas",
          status: data.status || "stopped",
          emoji: data.emoji || "🤖",
        });
      }
    } catch {
      // Ignore — keep defaults
    }
  }, []);

  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchInfo]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  const statusColors: Record<AgentStatus, string> = {
    running: "bg-green-500",
    stopped: "bg-red-500",
    pending: "bg-yellow-500",
  };

  const statusLabels: Record<AgentStatus, string> = {
    running: "Online",
    stopped: "Offline",
    pending: "Starting",
  };

  const statusBadgeText: Record<AgentStatus, string> = {
    running: "Ready for tasks",
    stopped: "Offline",
    pending: "Setting up",
  };

  return (
    <aside className="hidden w-[180px] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
      {/* Avatar */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sidebar-accent text-3xl">
        {info.emoji}
      </div>

      {/* Name */}
      <p className="mt-3 max-w-full truncate text-center text-sm font-semibold text-sidebar-foreground">
        {info.name}
      </p>

      {/* Status dot + label */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            statusColors[info.status],
            info.status === "running" && "animate-pulse",
          )}
        />
        <span className="text-xs text-sidebar-foreground/60">
          {statusLabels[info.status]}
        </span>
      </div>

      {/* Status badge */}
      <div className="mt-3 rounded-full bg-sidebar-accent px-3 py-1">
        <span className="text-[10px] font-medium text-sidebar-foreground/70">
          {statusBadgeText[info.status]}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="Log out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
