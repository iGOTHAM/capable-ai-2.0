"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Loader2,
  MessageSquare,
  User,
  Bot,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatEvent } from "./conversation-log";

interface MemoryViewerProps {
  path: string | null;
  editable?: boolean;
  conversationDate?: string | null;
  conversationMessages?: ChatEvent[];
}

export function MemoryViewer({
  path,
  editable = false,
  conversationDate,
  conversationMessages,
}: MemoryViewerProps) {
  const [content, setContent] = useState<string>("");
  const [meta, setMeta] = useState<{ size: number; modified: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  // ── Edit state (mirrors DocViewer pattern) ─────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUnsavedChanges = editing && content !== editContent;

  // Cmd+S to save while editing
  useEffect(() => {
    if (!editing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, editContent, path]);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    setEditing(false);
    setError(null);
    fetch(`/api/docs/${encodeURIComponent(path)}`)
      .then((res) =>
        res.ok ? res.json() : { content: "", size: 0, modified: "" },
      )
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

  const handleCancelEdit = useCallback(() => {
    if (content !== editContent) {
      if (!confirm("You have unsaved changes. Discard them?")) return;
    }
    setEditing(false);
  }, [content, editContent]);

  const handleSave = async () => {
    if (!path) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setContent(editContent);
      setMeta((prev) =>
        prev ? { ...prev, modified: new Date().toISOString() } : null,
      );
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setEditContent(content);
    setEditing(true);
  };

  // ── Conversation transcript view ───────────────────────────────────────
  if (
    conversationDate &&
    conversationMessages &&
    conversationMessages.length > 0
  ) {
    const dateObj = new Date(conversationDate + "T00:00:00");
    const dateLabel = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Conversation Log</h2>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
            </div>
            <span className="ml-auto text-xs text-muted-foreground">
              {conversationMessages.length} message
              {conversationMessages.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 px-6 py-5">
          <div className="flex flex-col gap-4">
            {conversationMessages.map((msg, i) => {
              const isUser = msg.type === "chat.user_message";
              const time = new Date(msg.ts).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <div key={`${msg.ts}-${i}`} className="flex gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isUser
                        ? "bg-primary/10 text-primary"
                        : "bg-green-500/10 text-green-500"
                    }`}
                  >
                    {isUser ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {isUser ? "You" : "Agent"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {time}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/80 whitespace-pre-wrap">
                      {msg.summary}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Standard markdown view ─────────────────────────────────────────────
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

  const displayTitle = isMemoryMd ? "Long-Term Memory" : filename;
  const subtitle = isMemoryMd ? "Curated insights and lessons" : undefined;

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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          {isMemoryMd && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{displayTitle}</h2>
              {hasUnsavedChanges && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                  title="Unsaved changes"
                />
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editable && !editing && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={startEditing}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
            {editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{fileSizeKb} KB</span>
          <span>&middot;</span>
          <span>{wordCount} words</span>
          {meta?.modified && (
            <>
              <span>&middot;</span>
              <span>Modified {formatTimeAgo(meta.modified)}</span>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {editing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="h-full min-h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
          />
        ) : (
          <div className="px-6 py-5">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-base prose-h1:text-xl prose-h1:font-bold prose-h2:text-lg prose-h2:font-semibold prose-h3:text-base prose-h3:font-semibold prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-code:text-xs prose-pre:text-xs prose-blockquote:border-primary/30 prose-blockquote:text-foreground/70 prose-strong:text-foreground prose-em:text-foreground/80">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
