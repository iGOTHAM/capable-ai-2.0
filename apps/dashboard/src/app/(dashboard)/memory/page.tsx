"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Brain, Loader2, Search, Clipboard, Check } from "lucide-react";
import { PageHint } from "@/components/ui/page-hint";
import { MemoryList } from "@/components/memory/memory-list";
import type { MemoryEntry } from "@/components/memory/memory-list";
import { MemoryViewer } from "@/components/memory/memory-viewer";
import type { ChatEvent } from "@/components/memory/conversation-log";

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [chatEvents, setChatEvents] = useState<ChatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchMemories = useCallback(async () => {
    try {
      const [docsRes, eventsRes] = await Promise.all([
        fetch("/api/docs"),
        fetch("/api/events?type=chat"),
      ]);

      // Process docs
      if (docsRes.ok) {
        const data = await docsRes.json();
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
                editable: (node as DocNode & { editable?: boolean }).editable ?? false,
              });
            }
            if (node.children) flatten(node.children);
          }
        };
        flatten(data.docs || []);
        setEntries(flat);

        // Auto-select MEMORY.md if present and nothing selected
        if (flat.length > 0 && !selectedPath && !selectedConversation) {
          const memoryMd = flat.find((e) => e.path === "MEMORY.md");
          setSelectedPath(memoryMd?.path || flat[0]!.path);
        }
      }

      // Process chat events
      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setChatEvents(evData.events || []);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [selectedPath, selectedConversation]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Handle selection — selecting a file deselects conversation and vice versa
  const handleSelectPath = (path: string) => {
    setSelectedPath(path);
    setSelectedConversation(null);
  };

  const handleSelectConversation = (date: string) => {
    setSelectedConversation(date);
    setSelectedPath(null);
  };

  // Get messages for selected conversation date
  const selectedMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return chatEvents
      .filter((e) => e.ts.startsWith(selectedConversation))
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }, [selectedConversation, chatEvents]);

  // Check if today has a journal entry
  const todayStr = new Date().toISOString().slice(0, 10);
  const hasTodayJournal = entries.some(
    (e) => e.path.includes(todayStr) && (e.category === "journal" || e.path.startsWith("memory/")),
  );

  const filteredEntries = entries.filter(
    (e) =>
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.path.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText("Write your daily journal for today.");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0 && chatEvents.length === 0) {
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
    <div className="-m-4 sm:-m-6 flex flex-col h-[calc(100vh-3rem)]">
      <div className="px-4 pt-3 sm:px-6">
        <PageHint
          id="hint-memory"
          title="Agent Memory"
          description="Your agent's memory files live here. Edit MEMORY.md to shape what it remembers. Daily journals are auto-generated from conversations."
          icon={Brain}
        />
      </div>
      {/* Journal prompt banner */}
      {!hasTodayJournal && (
        <div className="flex items-center justify-between border-b border-border bg-amber-500/5 px-4 py-2.5">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            No journal entry for today. Ask your agent:{" "}
            <span className="font-medium">&quot;Write your daily journal&quot;</span>
          </p>
          <button
            onClick={handleCopyPrompt}
            className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Clipboard className="h-3 w-3" />
                Copy prompt
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
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
              onSelect={handleSelectPath}
              chatEvents={chatEvents}
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
            />
          </div>
        </div>

        {/* Right: Memory viewer */}
        <div className="flex-1 overflow-y-auto">
          <MemoryViewer
            path={selectedPath}
            editable={selectedPath ? (entries.find((e) => e.path === selectedPath)?.editable ?? false) : false}
            conversationDate={selectedConversation}
            conversationMessages={selectedMessages}
          />
        </div>
      </div>
    </div>
  );
}
