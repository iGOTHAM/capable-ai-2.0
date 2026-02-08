"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocEntry } from "@/lib/docs";

const CATEGORY_BADGES: Record<string, { label: string; className: string }> = {
  system: {
    label: "System",
    className: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  },
  knowledge: {
    label: "Knowledge",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  memory: {
    label: "Memory",
    className: "bg-green-500/15 text-green-400 border-green-500/20",
  },
  deal: {
    label: "Deal",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  },
  upload: {
    label: "Upload",
    className: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  },
};

function getDocEmoji(entry: DocEntry): string {
  if (entry.type === "folder") return "\uD83D\uDCC1";
  if (entry.category === "system") return "\uD83D\uDD12";
  const name = entry.name.toLowerCase();
  if (name.endsWith(".md")) return "\uD83D\uDCC4";
  if (name.endsWith(".json")) return "\uD83D\uDCCB";
  if (name.endsWith(".txt")) return "\uD83D\uDCC3";
  return "\uD83D\uDCC4";
}

// Flatten a nested DocEntry tree into a flat list of files
function flattenDocs(entries: DocEntry[]): DocEntry[] {
  const result: DocEntry[] = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      result.push(entry);
    }
    if (entry.children) {
      result.push(...flattenDocs(entry.children));
    }
  }
  return result;
}

interface DocSidebarProps {
  docs: DocEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onNewDoc: () => void;
}

export function DocSidebar({
  docs,
  selectedPath,
  onSelect,
  onNewDoc,
}: DocSidebarProps) {
  const [search, setSearch] = useState("");

  // Flatten and filter
  const flatDocs = useMemo(() => {
    const flat = flattenDocs(docs);
    // Sort by modified date (newest first), then by name
    return flat.sort((a, b) => {
      if (a.modified && b.modified) {
        return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      }
      return a.name.localeCompare(b.name);
    });
  }, [docs]);

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return flatDocs;
    const term = search.toLowerCase();
    return flatDocs.filter((doc) => doc.name.toLowerCase().includes(term));
  }, [flatDocs, search]);

  return (
    <div className="flex h-full flex-col border-r">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Documents</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onNewDoc}
          title="New document"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search docs..."
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Flat list */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {filteredDocs.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {search ? "No matching documents" : "No documents yet"}
            </p>
          )}
          {filteredDocs.map((doc) => {
            const isSelected = selectedPath === doc.path;
            const badge = CATEGORY_BADGES[doc.category];
            const emoji = getDocEmoji(doc);

            return (
              <button
                key={doc.path}
                onClick={() => onSelect(doc.path)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted",
                )}
              >
                {/* Emoji */}
                <span className="text-base shrink-0">{emoji}</span>

                {/* Title + date */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-xs truncate",
                      isSelected && "font-medium",
                    )}
                  >
                    {doc.name}
                  </p>
                  {doc.modified && (
                    <p className="text-[10px] text-muted-foreground/60">
                      {new Date(doc.modified).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Category badge */}
                {badge && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[9px] px-1.5 py-0",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
