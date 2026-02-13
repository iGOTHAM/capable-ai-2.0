"use client";

import { Brain, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemoryEntry {
  id: string;
  title: string;
  path: string;
  category: string;
  modified?: string;
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface MemoryListProps {
  entries: MemoryEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function MemoryList({ entries, selectedPath, onSelect }: MemoryListProps) {
  return (
    <div className="flex flex-col">
      {entries.map((entry) => {
        const isSelected = entry.path === selectedPath;
        const isMain = entry.path === "MEMORY.md";
        return (
          <button
            key={entry.id}
            onClick={() => onSelect(entry.path)}
            className={cn(
              "flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/50",
              "hover:bg-accent/50",
              isSelected && "bg-accent",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                isMain
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isMain ? (
                <Brain className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm font-medium",
                  isSelected ? "text-foreground" : "text-foreground/80",
                )}
              >
                {entry.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {entry.category}
                </span>
                {entry.modified && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimeAgo(entry.modified)}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
