"use client";

import { useState, useEffect } from "react";
import { Brain, Loader2 } from "lucide-react";

interface MemoryViewerProps {
  path: string | null;
}

export function MemoryViewer({ path }: MemoryViewerProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    fetch(`/api/docs/${encodeURIComponent(path)}`)
      .then((res) => (res.ok ? res.json() : { content: "" }))
      .then((data) => setContent(data.content || ""))
      .catch(() => setContent(""))
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
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold">{filename}</h2>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{wordCount} words</span>
          <span>{(new Blob([content]).size / 1024).toFixed(1)} KB</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5">
        <div className="prose prose-sm prose-invert max-w-none">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown rendering — splits by headings and renders sections
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let currentBlock: string[] = [];
  let blockKey = 0;

  const flushBlock = () => {
    if (currentBlock.length > 0) {
      const text = currentBlock.join("\n");
      elements.push(
        <p key={blockKey++} className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
          {text}
        </p>,
      );
      currentBlock = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      flushBlock();
      elements.push(
        <h1 key={blockKey++} className="mb-3 mt-6 text-xl font-bold first:mt-0">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushBlock();
      elements.push(
        <h2 key={blockKey++} className="mb-2 mt-5 text-lg font-semibold first:mt-0">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      flushBlock();
      elements.push(
        <h3 key={blockKey++} className="mb-2 mt-4 text-base font-semibold first:mt-0">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushBlock();
      elements.push(
        <li key={blockKey++} className="ml-4 text-sm leading-relaxed text-foreground/80 list-disc">
          {line.slice(2)}
        </li>,
      );
    } else if (line.trim() === "") {
      flushBlock();
    } else {
      currentBlock.push(line);
    }
  }
  flushBlock();

  return <>{elements}</>;
}
