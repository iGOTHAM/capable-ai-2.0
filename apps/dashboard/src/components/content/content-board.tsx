"use client";

import { useState } from "react";
import { FileText, Search, BookOpen, Upload, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentItem {
  path: string;
  name: string;
  category: string;
  modified?: string;
  size?: number;
}

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  knowledge: BookOpen,
  upload: Upload,
  content: FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  knowledge: "bg-blue-500/10 text-blue-400",
  upload: "bg-purple-500/10 text-purple-400",
  content: "bg-green-500/10 text-green-400",
};

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

interface ContentBoardProps {
  items: ContentItem[];
}

export function ContentBoard({ items }: ContentBoardProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Get unique categories
  const categories = Array.from(new Set(items.map((i) => i.category)));

  const filtered = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.path.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      !activeCategory || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Search + Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search content..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              !activeCategory
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setActiveCategory(activeCategory === cat ? null : cat)
              }
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize",
                activeCategory === cat
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const Icon = CATEGORY_ICONS[item.category] || FileText;
          const colorClass =
            CATEGORY_COLORS[item.category] || CATEGORY_COLORS.content;
          return (
            <a
              key={item.path}
              href={`/docs?path=${encodeURIComponent(item.path)}`}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    colorClass,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-foreground">
                    {item.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                      {item.category}
                    </span>
                    {item.modified && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(item.modified)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No content matches your filters
        </p>
      )}
    </div>
  );
}
