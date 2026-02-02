"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Activity,
  Clock,
  ShieldCheck,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/now", label: "Now", icon: Activity },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

type AgentStatus = "running" | "stopped" | "pending";

function AgentStatusDot() {
  const [status, setStatus] = useState<AgentStatus>("stopped");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/setup/status");
      if (res.ok) {
        const data = await res.json();
        if (data.setupState === "pending") {
          setStatus("pending");
        } else if (data.daemonRunning) {
          setStatus("running");
        } else {
          setStatus("stopped");
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const colors: Record<AgentStatus, string> = {
    running: "bg-green-500",
    stopped: "bg-red-500",
    pending: "bg-yellow-500",
  };

  const labels: Record<AgentStatus, string> = {
    running: "Agent running",
    stopped: "Agent stopped",
    pending: "Setup pending",
  };

  return (
    <div className="flex items-center gap-2" title={labels[status]}>
      <div className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} />
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {labels[status]}
      </span>
    </div>
  );
}

export function DashboardHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur lg:px-6">
        <div className="lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <AgentStatusDot />
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 top-14 z-50 bg-background/80 backdrop-blur-sm lg:hidden">
          <nav className="border-b bg-background p-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/70",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
