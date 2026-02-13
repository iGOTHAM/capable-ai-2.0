"use client";

import { useState, useEffect, useCallback } from "react";
import { Brain, Loader2, Search } from "lucide-react";
import { MemoryList } from "@/components/memory/memory-list";
import type { MemoryEntry } from "@/components/memory/memory-list";
import { MemoryViewer } from "@/components/memory/memory-viewer";

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchMemories = useCallback(async () => {
    try {
      const res = await fetch("/api/docs");
      if (!res.ok) throw new Error("Failed to fetch docs");
      const data = await res.json();

      // Flatten and filter for memory-related files
      const flat: MemoryEntry[] = [];
      interface DocNode {
        path: string;
        name: string;
        category?: string;
        modified?: string;
        size?: number;
        children?: DocNode[];
      }
      const flatten = (nodes: DocNode[]) => {
        for (const node of nodes) {
          const isMemory =
            node.category === "memory" ||
            node.category === "journal" ||
            node.path.startsWith("memory/") ||
            node.path === "MEMORY.md" ||
            node.path.includes("lessons") ||
            node.path.includes("directives");
          if (isMemory && node.path && !node.children) {
            flat.push({
              id: node.path,
              title: node.name || node.path.split("/").pop() || node.path,
              path: node.path,
              category: node.category || "memory",
              modified: node.modified,
              size: node.size,
            });
          }
          if (node.children) flatten(node.children);
        }
      };
      flatten(data.docs || []);
      setEntries(flat);

      // Auto-select MEMORY.md if present
      if (flat.length > 0 && !selectedPath) {
        const memoryMd = flat.find((e) => e.path === "MEMORY.md");
        setSelectedPath(memoryMd?.path || flat[0]!.path);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [selectedPath]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const filteredEntries = entries.filter(
    (e) =>
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.path.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Brain className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium">No memories yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your agent&apos;s memory files will appear here as it learns and remembers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 sm:-m-6 flex h-[calc(100vh-3rem)]">
      {/* Left: Memory list */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memory..."
              className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MemoryList
            entries={filteredEntries}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        </div>
      </div>

      {/* Right: Memory viewer */}
      <div className="flex-1 overflow-y-auto">
        <MemoryViewer path={selectedPath} />
      </div>
    </div>
  );
}
