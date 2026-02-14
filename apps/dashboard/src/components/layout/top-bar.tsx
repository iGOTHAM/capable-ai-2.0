"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  Search,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchModal } from "@/components/search/search-modal";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

type AgentStatus = "running" | "stopped" | "pending";

interface AgentInfo {
  name: string;
  status: AgentStatus;
  emoji: string;
}

const pageTitles: Record<string, string> = {
  "/tasks": "Tasks",
  "/content": "Skills",
  "/approvals": "Approvals",
  "/calendar": "Calendar",
  "/pipeline": "Office",
  "/memory": "Memory",
  "/docs": "Docs",
  "/settings": "Settings",
  "/timeline": "Activity",
  "/now": "Dashboard",
};

export function TopBar() {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [info, setInfo] = useState<AgentInfo>({
    name: "Atlas",
    status: "stopped",
    emoji: "\u{1F916}",
  });
  // Agent info polling
  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-info");
      if (res.ok) {
        const data = await res.json();
        setInfo({
          name: data.name || "Atlas",
          status: data.status || "stopped",
          emoji: data.emoji || "\u{1F916}",
        });
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchInfo]);

  // Cmd+K / Ctrl+K search shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const pageTitle =
    pageTitles[pathname] ||
    pageTitles[Object.keys(pageTitles).find((k) => pathname.startsWith(k)) || ""] ||
    "Dashboard";

  const statusColors: Record<AgentStatus, string> = {
    running: "bg-green-500",
    stopped: "bg-red-500",
    pending: "bg-yellow-500",
  };

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/50 px-4">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-medium text-foreground">{pageTitle}</h2>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Search (⌘K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-border bg-background px-1 py-0.5 text-[9px] sm:inline-block">
              ⌘K
            </kbd>
          </button>

          {/* Ping Agent */}
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={`Chat with ${info.name}`}
            onClick={() => {
              // Dispatch a custom event that ChatPopup can listen for
              window.dispatchEvent(new CustomEvent("open-chat"));
            }}
          >
            <div className="relative">
              <MessageCircle className="h-3.5 w-3.5" />
              <div
                className={cn(
                  "absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full",
                  statusColors[info.status],
                )}
              />
            </div>
            <span className="hidden sm:inline">{info.name}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={() => window.location.reload()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <ThemeToggle />
        </div>
      </header>

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
