"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronRight } from "lucide-react";
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

// Flatten all files for search mode
function flattenFiles(entries: DocEntry[]): DocEntry[] {
  const result: DocEntry[] = [];
  for (const entry of entries) {
    if (entry.type === "file") {
      result.push(entry);
    }
    if (entry.children) {
      result.push(...flattenFiles(entry.children));
    }
  }
  return result;
}

// Recursive tree item component
function DocTreeItem({
  entry,
  depth,
  selectedPath,
  onSelect,
  expandedFolders,
  toggleFolder,
}: {
  entry: DocEntry;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}) {
  const isFolder = entry.type === "folder";
  const isExpanded = expandedFolders.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const emoji = getDocEmoji(entry);
  const badge = CATEGORY_BADGES[entry.category];

  return (
    <>
      <button
        onClick={() => {
          if (isFolder) {
            toggleFolder(entry.path);
          } else {
            onSelect(entry.path);
          }
        }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
            : "text-foreground/80 hover:bg-muted",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Folder chevron or spacer */}
        {isFolder ? (
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Emoji */}
        <span className="text-sm shrink-0">{emoji}</span>

        {/* Name */}
        <span
          className={cn(
            "flex-1 min-w-0 text-xs truncate",
            isSelected && "font-medium",
            isFolder && "font-medium",
          )}
        >
          {entry.name}
        </span>

        {/* Category badge for files */}
        {!isFolder && badge && (
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

        {/* Child count for folders */}
        {isFolder && entry.children && entry.children.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50 shrink-0">
            {entry.children.length}
          </span>
        )}
      </button>

      {/* Children */}
      {isFolder && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <DocTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </>
  );
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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeExtensions, setActiveExtensions] = useState<Set<string>>(new Set());
  const knownFoldersRef = useRef<Set<string>>(new Set());

  // Extract all unique categories and file extensions
  const allFiles = useMemo(() => flattenFiles(docs), [docs]);
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const f of allFiles) {
      if (f.category) cats.add(f.category);
    }
    return Array.from(cats);
  }, [allFiles]);
  const allExtensions = useMemo(() => {
    const exts = new Set<string>();
    for (const f of allFiles) {
      const ext = f.name.includes(".") ? "." + f.name.split(".").pop() : "";
      if (ext) exts.add(ext);
    }
    return Array.from(exts).sort();
  }, [allFiles]);

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleExtension = (ext: string) => {
    setActiveExtensions((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext); else next.add(ext);
      return next;
    });
  };

  // Collect all folder paths recursively
  function collectFolderPaths(entries: DocEntry[]): string[] {
    const paths: string[] = [];
    for (const entry of entries) {
      if (entry.type === "folder") {
        paths.push(entry.path);
        if (entry.children) {
          paths.push(...collectFolderPaths(entry.children));
        }
      }
    }
    return paths;
  }

  // Auto-expand top-level folders on first load, and auto-expand any new folders
  useEffect(() => {
    const allFolders = collectFolderPaths(docs);
    const newFolders = allFolders.filter((p) => !knownFoldersRef.current.has(p));
    if (newFolders.length > 0) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        for (const f of newFolders) {
          next.add(f);
        }
        return next;
      });
    }
    knownFoldersRef.current = new Set(allFolders);
  }, [docs]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Flat file list for search/filter mode
  const searchResults = useMemo(() => {
    const hasFilters = activeCategories.size > 0 || activeExtensions.size > 0;
    if (!search.trim() && !hasFilters) return [];
    const term = search.toLowerCase();
    return flattenFiles(docs)
      .filter((doc) => {
        if (term && !doc.name.toLowerCase().includes(term)) return false;
        if (activeCategories.size > 0 && !activeCategories.has(doc.category)) return false;
        if (activeExtensions.size > 0) {
          const ext = doc.name.includes(".") ? "." + doc.name.split(".").pop() : "";
          if (!activeExtensions.has(ext)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.modified && b.modified) {
          return new Date(b.modified).getTime() - new Date(a.modified).getTime();
        }
        return a.name.localeCompare(b.name);
      });
  }, [docs, search, activeCategories, activeExtensions]);

  const isSearching = search.trim().length > 0 || activeCategories.size > 0 || activeExtensions.size > 0;

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
            placeholder="Search documents..."
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Category filter chips */}
      {allCategories.length > 1 && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {allCategories.map((cat) => {
            const badge = CATEGORY_BADGES[cat];
            const isActive = activeCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors border",
                  isActive
                    ? (badge?.className || "bg-foreground/10 text-foreground border-foreground/20")
                    : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground",
                )}
              >
                {badge?.label || cat}
              </button>
            );
          })}
        </div>
      )}

      {/* File type filter chips */}
      {allExtensions.length > 1 && (
        <div className="flex items-center gap-1 px-3 pb-2">
          <span className="text-[10px] text-muted-foreground/50 mr-1">▼</span>
          {allExtensions.map((ext) => {
            const isActive = activeExtensions.has(ext);
            return (
              <button
                key={ext}
                onClick={() => toggleExtension(ext)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {ext}
              </button>
            );
          })}
        </div>
      )}

      {/* Tree view or search results */}
      <ScrollArea className="flex-1">
        <div className="px-1 pb-4">
          {isSearching ? (
            <>
              {searchResults.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No matching documents
                </p>
              )}
              {searchResults.map((doc) => {
                const isSelected = selectedPath === doc.path;
                const badge = CATEGORY_BADGES[doc.category];
                const emoji = getDocEmoji(doc);

                return (
                  <button
                    key={doc.path}
                    onClick={() => onSelect(doc.path)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-muted",
                    )}
                  >
                    <span className="text-sm shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs truncate", isSelected && "font-medium")}>
                        {doc.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 truncate">
                        {doc.path}
                      </p>
                    </div>
                    {badge && (
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 text-[9px] px-1.5 py-0", badge.className)}
                      >
                        {badge.label}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </>
          ) : (
            <>
              {docs.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No documents yet
                </p>
              )}
              {docs.map((entry) => (
                <DocTreeItem
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
