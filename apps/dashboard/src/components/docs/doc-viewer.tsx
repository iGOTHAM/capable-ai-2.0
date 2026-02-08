"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold truncate">{fileName}</h3>
          {doc.modified && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {new Date(doc.modified).toLocaleDateString()}
            </span>
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
              onClick={() => setEditing(false)}
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {editing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="h-full min-h-full w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {doc.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
