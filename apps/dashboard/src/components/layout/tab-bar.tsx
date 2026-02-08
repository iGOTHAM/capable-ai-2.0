"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/tasks", label: "Dashboard" },
  { href: "/docs", label: "Docs" },
  { href: "/timeline", label: "Log" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <div className="flex h-12 items-center border-b bg-background/95 backdrop-blur">
      <nav className="flex h-full items-stretch gap-1 px-4">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href === "/tasks" && pathname === "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex items-center px-4 text-sm font-medium transition-colors",
                "hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {tab.label}
              {/* Active underline */}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2 pr-4">
        <ThemeToggle />
      </div>
    </div>
  );
}
