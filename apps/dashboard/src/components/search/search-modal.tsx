"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  FileText,
  CheckSquare,
  ArrowRight,
  Command,
  Brain,
  Clock,
} from "lucide-react";
interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DocResult {
  path: string;
  name: string;
}

interface TaskResult {
  id: string;
  title: string;
  status: string;
}

interface ProjectResult {
  id: string;
  name: string;
  category: string;
  metric: { label: string; value: string };
}

interface EventResult {
  ts: string;
  type: string;
  summary: string;
}

interface SearchResult {
  id: string;
  title: string;
  meta?: string;
  category: "PROJECTS" | "DOCUMENTS" | "TASKS" | "MEMORY" | "ACTIVITY";
  href: string;
  icon: "project" | "doc" | "task" | "memory" | "event";
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<DocResult[]>([]);
  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [events, setEvents] = useState<EventResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch docs + tasks + projects on open
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);

    // Fetch docs
    fetch("/api/docs")
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((data) => {
        const flat: DocResult[] = [];
        interface DocNode {
          path: string;
          name: string;
          children?: DocNode[];
        }
        const flatten = (entries: DocNode[]) => {
          for (const e of entries) {
            if (e.path) flat.push({ path: e.path, name: e.name || e.path });
            if (e.children) flatten(e.children);
          }
        };
        flatten(data.docs || []);
        setDocs(flat);
      })
      .catch(() => setDocs([]));

    // Fetch tasks
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((data) => setTasks(data.tasks || []))
      .catch(() => setTasks([]));

    // Fetch projects from pipeline API
    fetch("/api/pipeline")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((data) => setProjects(data.projects || []))
      .catch(() => setProjects([]));

    // Fetch events for activity search
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data) => setEvents((data.events || []).slice(-50)))
      .catch(() => setEvents([]));
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const items: SearchResult[] = [];

    // Projects
    for (const p of projects) {
      if (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) {
        items.push({
          id: `project-${p.id}`,
          title: p.name,
          meta: `${p.category} · ${p.metric.value} ${p.metric.label}`,
          category: "PROJECTS",
          href: `/pipeline/${p.id}`,
          icon: "project",
        });
      }
    }

    // Docs
    for (const d of docs) {
      if (!q || d.name.toLowerCase().includes(q) || d.path.toLowerCase().includes(q)) {
        items.push({
          id: `doc-${d.path}`,
          title: d.name,
          meta: d.path,
          category: "DOCUMENTS",
          href: `/docs?path=${encodeURIComponent(d.path)}`,
          icon: "doc",
        });
      }
    }

    // Tasks
    for (const t of tasks) {
      if (!q || t.title.toLowerCase().includes(q)) {
        items.push({
          id: `task-${t.id}`,
          title: t.title,
          meta: t.status,
          category: "TASKS",
          href: "/tasks",
          icon: "task",
        });
      }
    }

    // Memory files (filter docs for memory-related)
    for (const d of docs) {
      const isMemory =
        d.path.startsWith("memory/") ||
        d.path === "MEMORY.md" ||
        d.path.includes("memory") ||
        d.path.includes("lessons") ||
        d.path.includes("directives");
      if (isMemory && (!q || d.name.toLowerCase().includes(q) || d.path.toLowerCase().includes(q))) {
        items.push({
          id: `memory-${d.path}`,
          title: d.name,
          meta: d.path,
          category: "MEMORY",
          href: `/memory`,
          icon: "memory",
        });
      }
    }

    // Activity events (only when searching)
    if (q) {
      for (const e of events) {
        if (e.summary.toLowerCase().includes(q)) {
          items.push({
            id: `event-${e.ts}`,
            title: e.summary,
            meta: `${e.type} · ${new Date(e.ts).toLocaleString()}`,
            category: "ACTIVITY",
            href: "/timeline",
            icon: "event",
          });
        }
      }
    }

    return items;
  }, [query, docs, tasks, projects, events]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: { category: string; items: SearchResult[] }[] = [];
    const categoryOrder: SearchResult["category"][] = [
      "PROJECTS",
      "DOCUMENTS",
      "TASKS",
      "MEMORY",
      "ACTIVITY",
    ];

    for (const cat of categoryOrder) {
      const items = results.filter((r) => r.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }

    return groups;
  }, [results]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  const navigate = useCallback(
    (result: SearchResult) => {
      onOpenChange(false);
      router.push(result.href);
    },
    [onOpenChange, router],
  );

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        navigate(results[selectedIndex]);
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [results, selectedIndex, navigate, onOpenChange],
  );

  // Scroll selected into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Highlight match
  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="rounded-sm bg-primary/20 text-foreground px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const IconForType = ({ type }: { type: SearchResult["icon"] }) => {
    switch (type) {
      case "project":
        return <Building2 className="h-4 w-4" />;
      case "doc":
        return <FileText className="h-4 w-4" />;
      case "task":
        return <CheckSquare className="h-4 w-4" />;
      case "memory":
        return <Brain className="h-4 w-4" />;
      case "event":
        return <Clock className="h-4 w-4" />;
    }
  };

  if (!open) return null;

  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-[15vh] z-50 w-full max-w-[580px] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, docs, tasks..."
            className="h-14 flex-1 bg-transparent text-[17px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[420px] overflow-y-auto py-2"
        >
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category}>
                {/* Category header */}
                <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.category}
                </div>

                {group.items.map((result) => {
                  const thisIndex = flatIndex++;
                  const isSelected = thisIndex === selectedIndex;
                  return (
                    <button
                      key={result.id}
                      data-index={thisIndex}
                      onClick={() => navigate(result)}
                      onMouseEnter={() => setSelectedIndex(thisIndex)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <IconForType type={result.icon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {highlight(result.title)}
                        </div>
                        {result.meta && (
                          <div className="truncate text-xs text-muted-foreground">
                            {result.meta}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">↵</kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">esc</kbd>
              Close
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </>
  );
}
