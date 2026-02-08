"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  MessageSquare,
  Clock,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/now", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/docs", label: "Docs", icon: FileText },
  { href: "/open-chat", label: "Chat", icon: MessageSquare },
  { href: "/timeline", label: "Activity", icon: Clock },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-sidebar lg:flex lg:flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-semibold">Capable</span>
        <span className="ml-1 text-xs text-muted-foreground">Dashboard</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/now" && pathname === "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {/* Spacer + Advanced section */}
        <div className="mt-auto flex flex-col gap-1">
          <Separator className="my-2" />
          <a
            href="/chat/"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              "text-sidebar-foreground/50",
            )}
            title="Open the OpenClaw native interface for advanced settings"
          >
            <Settings className="h-4 w-4" />
            Advanced
          </a>
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              "text-sidebar-foreground/70",
            )}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </nav>
    </aside>
  );
}
