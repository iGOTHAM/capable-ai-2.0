"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ExternalLink, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchModal } from "@/components/search/search-modal";
import { cn } from "@/lib/utils";

type AgentStatus = "running" | "stopped" | "pending";

interface AgentInfo {
  name: string;
  status: AgentStatus;
  emoji: string;
}

const tabs = [
  { href: "/timeline", label: "Activity" },
  { href: "/tasks", label: "All Tasks" },
  { href: "/docs", label: "Docs" },
  { href: "/settings", label: "Settings" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [info, setInfo] = useState<AgentInfo>({
    name: "Atlas",
    status: "stopped",
    emoji: "\u{1F916}",
  });
  const [searchOpen, setSearchOpen] = useState(false);

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
      // Ignore — keep defaults
    }
  }, []);

  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchInfo]);

  // Cmd+K / Ctrl+K global shortcut
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

  return (
    <>
      <header className="shrink-0 border-b border-border bg-card">
        {/* Top row: agent info + actions */}
        <div className="flex items-center justify-between px-4 py-5 sm:px-7">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-2xl">
              {info.emoji}
            </div>
            <div>
              <h1 className="text-[15px] font-semibold leading-tight">
                {info.name}
              </h1>
              <div className="mt-0.5 flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-[7px] w-[7px] rounded-full",
                    statusColors[info.status],
                    info.status === "running" && "shadow-[0_0_8px] shadow-green-500",
                  )}
                />
                <span className="text-xs text-green-500">
                  {statusLabels[info.status]}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Search (⌘K)"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] sm:inline-block">
                ⌘K
              </kbd>
            </button>
            <ThemeToggle />
            <a
              href="/chat/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Open Advanced UI"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab row */}
        <nav className="flex items-center gap-0.5 overflow-x-auto px-4 sm:px-7 scrollbar-hide">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href === "/timeline" && pathname === "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex items-center px-5 pb-3.5 pt-1 text-[13px] font-medium transition-colors",
                  "hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
