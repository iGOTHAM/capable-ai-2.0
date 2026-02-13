"use client";

import { useState } from "react";
import {
  FileText,
  Search,
  BookOpen,
  Newspaper,
  Video,
  MessageSquare,
  Image,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentItem {
  path: string;
  name: string;
  category: string;
  modified?: string;
  size?: number;
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: typeof FileText; color: string }
> = {
  scripts: {
    label: "Scripts",
    icon: Video,
    color: "bg-red-500/10 text-red-400",
  },
  newsletters: {
    label: "Newsletters",
    icon: Newspaper,
    color: "bg-cyan-500/10 text-cyan-400",
  },
  social: {
    label: "Social",
    icon: MessageSquare,
    color: "bg-pink-500/10 text-pink-400",
  },
  content: {
    label: "Content",
    icon: BookOpen,
    color: "bg-teal-500/10 text-teal-400",
  },
  thumbnails: {
    label: "Thumbnails",
    icon: Image,
    color: "bg-purple-500/10 text-purple-400",
  },
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

const EXAMPLE_PROMPT = `I want you to build me a content factory inside of Discord. Set up channels for different agents. Have an agent that researches top trending stories, another agent that takes those stories and writes scripts, then another agent that generates thumbnails. Have all their work organized in different channels.`;

interface ContentBoardProps {
  items: ContentItem[];
}

export function ContentBoard({ items }: ContentBoardProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Empty state — no content production folders exist yet
  if (items.length === 0) {
    const handleCopy = async () => {
      await navigator.clipboard.writeText(EXAMPLE_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="flex flex-col items-center gap-6 py-16 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-lg font-semibold">Content Factory</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Set up your agent to produce content automatically — scripts,
            newsletters, social posts, and thumbnails will appear here.
          </p>
        </div>

        {/* Example prompt */}
        <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Example prompt to get started
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-foreground/70 leading-relaxed">
            {EXAMPLE_PROMPT}
          </p>
        </div>

        {/* Content type hints */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5",
                  config.color,
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="text-xs font-medium">{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            return (
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
                {config?.label || cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const config = CATEGORY_CONFIG[item.category];
          const Icon = config?.icon || FileText;
          const colorClass = config?.color || "bg-muted text-muted-foreground";
          const wordCount = item.size
            ? Math.round(item.size / 5)
            : null;
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
                      {config?.label || item.category}
                    </span>
                    {wordCount && (
                      <span className="text-[10px] text-muted-foreground">
                        {wordCount} words
                      </span>
                    )}
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

      {filtered.length === 0 && items.length > 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No content matches your filters
        </p>
      )}
    </div>
  );
}
