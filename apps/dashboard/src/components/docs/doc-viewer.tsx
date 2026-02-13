"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AiSummaryCard } from "./ai-summary-card";
import { ExtractedMetricsCard } from "./extracted-metrics-card";

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

interface DocViewerProps {
  path: string | null;
  editable: boolean;
}

interface DocData {
  content: string;
  size: number;
  modified: string;
}

export function DocViewer({ path, editable }: DocViewerProps) {
  const [doc, setDoc] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUnsavedChanges = editing && doc && editContent !== doc.content;

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
  }, [editing, editContent, path]);

  // Fetch document content
  useEffect(() => {
    if (!path) {
      setDoc(null);
      return;
    }

    setLoading(true);
    setEditing(false);
    setError(null);

    fetch(`/api/docs/${path}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load document");
        return res.json();
      })
      .then((data) => {
        setDoc({
          content: data.content,
          size: data.size,
          modified: data.modified,
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setDoc(null);
      })
      .finally(() => setLoading(false));
  }, [path]);

  // Cancel editing with unsaved changes confirmation
  const handleCancelEdit = useCallback(() => {
    if (doc && editContent !== doc.content) {
      if (!confirm("You have unsaved changes. Discard them?")) return;
    }
    setEditing(false);
  }, [doc, editContent]);

  // Save document
  const handleSave = async () => {
    if (!path) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/docs/${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setDoc((prev) =>
        prev
          ? { ...prev, content: editContent, modified: new Date().toISOString() }
          : null,
      );
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Enter edit mode
  const startEditing = () => {
    if (doc) {
      setEditContent(doc.content);
      setEditing(true);
    }
  };

  // Empty state
  if (!path) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="h-12 w-12 opacity-30" />
          <p className="text-sm">Select a document to view</p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  const fileName = path.split("/").pop() || path;
  const wordCount = doc.content.split(/\s+/).filter(Boolean).length;
  const fileSizeKb = (doc.size / 1024).toFixed(1);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base font-semibold truncate">{fileName}</h3>
            {hasUnsavedChanges && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Unsaved changes" />
            )}
            {!editable && (
              <Badge variant="outline" className="text-[9px] shrink-0">
                Read-only
              </Badge>
            )}
          </div>
        {editable && !editing && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={startEditing}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
        {editing && (
          <div className="flex gap-2 shrink-0">
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
          </div>
        )}
        </div>

        {/* File stats row */}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
          <span>{fileSizeKb} KB</span>
          <span>&middot;</span>
          <span>{wordCount} Words</span>
          {doc.modified && (
            <>
              <span>&middot;</span>
              <span>Modified {formatTimeAgo(doc.modified)}</span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {editing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="h-full min-h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
          />
        ) : (
          <div className="p-4 flex flex-col gap-4">
            {/* AI Summary + Extracted Metrics cards */}
            <AiSummaryCard path={path} />
            <ExtractedMetricsCard path={path} />

            {/* Markdown content */}
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-base prose-h1:text-lg prose-h1:font-bold prose-h2:text-base prose-h2:font-semibold prose-h3:text-sm prose-h3:font-semibold prose-p:text-sm prose-p:leading-relaxed prose-li:text-sm prose-code:text-xs prose-pre:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {doc.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
