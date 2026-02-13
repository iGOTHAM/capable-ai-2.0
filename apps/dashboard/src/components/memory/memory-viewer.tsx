"use client";

import { useState, useEffect } from "react";
import { Brain, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MemoryViewerProps {
  path: string | null;
}

export function MemoryViewer({ path }: MemoryViewerProps) {
  const [content, setContent] = useState<string>("");
  const [meta, setMeta] = useState<{ size: number; modified: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    fetch(`/api/docs/${encodeURIComponent(path)}`)
      .then((res) => (res.ok ? res.json() : { content: "", size: 0, modified: "" }))
      .then((data) => {
        setContent(data.content || "");
        setMeta({ size: data.size || 0, modified: data.modified || "" });
      })
      .catch(() => {
        setContent("");
        setMeta(null);
      })
      .finally(() => setLoading(false));
  }, [path]);

  if (!path) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Brain className="h-8 w-8" />
        <p className="text-sm">Select a memory to view</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filename = path.split("/").pop() || path;
  const isMemoryMd = path === "MEMORY.md" || path === "memory/MEMORY.md";
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const fileSizeKb = meta ? (meta.size / 1024).toFixed(1) : "0";

  // Display title
  const displayTitle = isMemoryMd ? "Long-Term Memory" : filename;
  const subtitle = isMemoryMd
    ? "Curated insights and lessons"
    : undefined;

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

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          {isMemoryMd && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold">{displayTitle}</h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {meta?.modified && (
            <span className="ml-auto text-xs text-muted-foreground">
              Modified {formatTimeAgo(meta.modified)}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{fileSizeKb} KB</span>
          <span>&middot;</span>
          <span>{wordCount} words</span>
        </div>
      </div>

      {/* Content — use react-markdown for proper rendering */}
      <div className="flex-1 px-6 py-5">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-base prose-h1:text-xl prose-h1:font-bold prose-h2:text-lg prose-h2:font-semibold prose-h3:text-base prose-h3:font-semibold prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-code:text-xs prose-pre:text-xs prose-blockquote:border-primary/30 prose-blockquote:text-foreground/70 prose-strong:text-foreground prose-em:text-foreground/80">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
