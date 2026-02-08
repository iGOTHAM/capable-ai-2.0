"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DocEntry } from "@/lib/docs";

const CATEGORY_COLORS: Record<string, string> = {
  system: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  knowledge: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  memory: "bg-green-500/15 text-green-600 dark:text-green-400",
  deal: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  upload: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["knowledge", "memory", "deals"]),
  );

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

  // Filter docs by search
  const filterDocs = (entries: DocEntry[]): DocEntry[] => {
    if (!search.trim()) return entries;
    const term = search.toLowerCase();
    return entries.reduce<DocEntry[]>((acc, entry) => {
      if (entry.type === "folder") {
        const filteredChildren = filterDocs(entry.children || []);
        if (
          filteredChildren.length > 0 ||
          entry.name.toLowerCase().includes(term)
        ) {
          acc.push({ ...entry, children: filteredChildren });
        }
      } else if (entry.name.toLowerCase().includes(term)) {
        acc.push(entry);
      }
      return acc;
    }, []);
  };

  const filteredDocs = filterDocs(docs);

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

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {filteredDocs.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {search ? "No matching documents" : "No documents yet"}
            </p>
          )}
          {filteredDocs.map((entry) => (
            <DocTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              selectedPath={selectedPath}
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggleFolder={toggleFolder}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Tree Item ──────────────────────────────────────────────────────────────

interface DocTreeItemProps {
  entry: DocEntry;
  depth: number;
  selectedPath: string | null;
  expandedFolders: Set<string>;
  onSelect: (path: string) => void;
  onToggleFolder: (path: string) => void;
}

function DocTreeItem({
  entry,
  depth,
  selectedPath,
  expandedFolders,
  onSelect,
  onToggleFolder,
}: DocTreeItemProps) {
  const isFolder = entry.type === "folder";
  const isExpanded = expandedFolders.has(entry.path);
  const isSelected = selectedPath === entry.path;

  return (
    <div>
      <button
        onClick={() => {
          if (isFolder) {
            onToggleFolder(entry.path);
          } else {
            onSelect(entry.path);
          }
        }}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground/80 hover:bg-muted"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Chevron for folders */}
        {isFolder ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3" />
        )}

        {/* Icon */}
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        {/* Name */}
        <span className="truncate">{entry.name}</span>

        {/* Category badge for top-level items */}
        {depth === 0 && entry.category !== "knowledge" && (
          <Badge
            variant="outline"
            className={`ml-auto text-[9px] px-1 py-0 ${CATEGORY_COLORS[entry.category] || ""}`}
          >
            {entry.category}
          </Badge>
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
              expandedFolders={expandedFolders}
              onSelect={onSelect}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
