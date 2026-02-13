"use client";

import { useMemo, useState } from "react";
import { Brain, FileText, Calendar, ChevronDown, Sparkles, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationLog } from "./conversation-log";
import type { ChatEvent } from "./conversation-log";

export interface MemoryEntry {
  id: string;
  title: string;
  path: string;
  category: string;
  modified?: string;
  size?: number;
  editable?: boolean;
}

// ─── Date grouping helpers ─────────────────────────────────────────────────

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function parseDateFromName(name: string): Date | null {
  const match = name.replace(/\.[^.]+$/, "").match(DATE_PATTERN);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getDateGroupLabel(date: Date, now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  if (date >= weekAgo) return "This Week";
  if (date >= monthStart) return "This Month";

  // Older: show "January 2026", "December 2025", etc.
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatEntryDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes: number): string {
  return (bytes / 1024).toFixed(1) + " KB";
}

function estimateWordCount(size: number): number {
  // Rough estimate: ~5 chars per word on average for markdown
  return Math.round(size / 5);
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface DateGroup {
  label: string;
  entries: Array<MemoryEntry & { date: Date }>;
}

interface MemoryListProps {
  entries: MemoryEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  chatEvents?: ChatEvent[];
  selectedConversation?: string | null;
  onSelectConversation?: (date: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MemoryList({
  entries,
  selectedPath,
  onSelect,
  chatEvents = [],
  selectedConversation,
  onSelectConversation,
}: MemoryListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Separate entries into: long-term memory, reference files, journal entries
  const { longTermMemory, referenceFiles, dateGroups, totalJournalCount } = useMemo(() => {
    const ltm = entries.find(
      (e) => e.path === "MEMORY.md" || e.path === "memory/MEMORY.md",
    );
    const refs: MemoryEntry[] = [];
    const journalEntries: Array<MemoryEntry & { date: Date }> = [];

    for (const entry of entries) {
      if (entry.path === "MEMORY.md" || entry.path === "memory/MEMORY.md") continue;

      const date = parseDateFromName(entry.title || entry.path.split("/").pop() || "");
      if (date) {
        journalEntries.push({ ...entry, date });
      } else {
        refs.push(entry);
      }
    }

    // Sort journal entries newest first
    journalEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Group by date period
    const now = new Date();
    const groupMap = new Map<string, Array<MemoryEntry & { date: Date }>>();
    for (const entry of journalEntries) {
      const label = getDateGroupLabel(entry.date, now);
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label)!.push(entry);
    }

    const groups: DateGroup[] = [];
    for (const [label, groupEntries] of groupMap) {
      groups.push({ label, entries: groupEntries });
    }

    return {
      longTermMemory: ltm || null,
      referenceFiles: refs,
      dateGroups: groups,
      totalJournalCount: journalEntries.length,
    };
  }, [entries]);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="flex flex-col">
      {/* ── Pinned: Long-Term Memory ──────────────────────────────────────── */}
      {longTermMemory && (
        <button
          onClick={() => onSelect(longTermMemory.path)}
          className={cn(
            "mx-3 mt-3 mb-2 flex items-center gap-3 rounded-xl p-3 text-left transition-all",
            selectedPath === longTermMemory.path
              ? "bg-primary/15 border border-primary/30 shadow-sm"
              : "bg-primary/5 border border-primary/10 hover:bg-primary/10",
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                Long-Term Memory
              </span>
              <Sparkles className="h-3 w-3 text-primary/60" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {longTermMemory.size && (
                <span className="text-[10px] text-muted-foreground">
                  {estimateWordCount(longTermMemory.size)} words
                </span>
              )}
              {longTermMemory.modified && (
                <>
                  <span className="text-[10px] text-muted-foreground">&middot;</span>
                  <span className="text-[10px] text-muted-foreground">
                    Updated {formatTimeAgo(longTermMemory.modified)}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>
      )}

      {/* ── Reference Files ──────────────────────────────────────────────── */}
      {referenceFiles.length > 0 && (
        <div className="mt-1">
          <div className="px-4 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Reference Files
            </span>
          </div>
          {referenceFiles.map((entry) => {
            const isSelected = entry.path === selectedPath;
            return (
              <button
                key={entry.id}
                onClick={() => onSelect(entry.path)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors",
                  "hover:bg-accent/50",
                  isSelected && "bg-accent",
                )}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span
                  className={cn(
                    "text-xs truncate",
                    isSelected ? "text-foreground font-medium" : "text-foreground/70",
                  )}
                >
                  {entry.title}
                </span>
                {entry.modified && (
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {formatTimeAgo(entry.modified)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Conversations ─────────────────────────────────────────────── */}
      {chatEvents.length > 0 && onSelectConversation && (
        <div className="mt-3">
          <div className="flex items-center gap-2 px-4 py-1.5">
            <MessageSquare className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Conversations
            </span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              {new Set(chatEvents.map((e) => e.ts.slice(0, 10))).size} days
            </span>
          </div>
          <ConversationLog
            chatEvents={chatEvents}
            selectedConversation={selectedConversation ?? null}
            onSelect={onSelectConversation}
          />
        </div>
      )}

      {/* ── Daily Journal ────────────────────────────────────────────────── */}
      <div className="mt-3">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <Calendar className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Daily Journal
          </span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            {totalJournalCount} entries
          </span>
        </div>

        {dateGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.label);
          return (
            <div key={group.label}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center gap-1.5 px-4 py-1.5 text-left hover:bg-accent/30 transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground/50 transition-transform",
                    isCollapsed && "-rotate-90",
                  )}
                />
                <span className="text-xs font-medium text-foreground/60">
                  {group.label}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  ({group.entries.length})
                </span>
              </button>

              {/* Group entries */}
              {!isCollapsed &&
                group.entries.map((entry) => {
                  const isSelected = entry.path === selectedPath;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => onSelect(entry.path)}
                      className={cn(
                        "flex w-full items-center gap-2.5 pl-8 pr-4 py-2 text-left transition-colors",
                        "hover:bg-accent/50",
                        isSelected && "bg-accent",
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-xs",
                            isSelected
                              ? "text-foreground font-medium"
                              : "text-foreground/70",
                          )}
                        >
                          {formatEntryDate(entry.date)}
                        </p>
                        {entry.size && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatFileSize(entry.size)} &middot;{" "}
                            {estimateWordCount(entry.size)} words
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          );
        })}

        {totalJournalCount === 0 && (
          <p className="px-4 py-4 text-xs text-muted-foreground/50 text-center">
            No journal entries yet
          </p>
        )}
      </div>
    </div>
  );
}
