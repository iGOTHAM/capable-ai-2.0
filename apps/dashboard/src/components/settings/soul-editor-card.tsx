"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, CheckCircle2, FileText } from "lucide-react";

export function SoulEditorCard() {
  const [content, setContent] = useState("");
  const [modified, setModified] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [originalContent, setOriginalContent] = useState("");

  useEffect(() => {
    fetch("/api/settings/soul")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setContent(data.content || "");
          setOriginalContent(data.content || "");
          setModified(data.modified || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/soul", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setOriginalContent(content);
        setSaved(true);
        setModified(new Date().toISOString());
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Silent
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = content !== originalContent;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-lg font-semibold">SOUL.md</span>
        {hasChanges && (
          <span className="h-2 w-2 rounded-full bg-amber-500" />
        )}
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Your agent&apos;s personality and instructions
      </p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        className="w-full resize-y rounded-lg border border-border bg-muted px-4 py-3 font-mono text-sm leading-relaxed outline-none focus:border-primary placeholder:text-muted-foreground"
        placeholder="# Agent Soul&#10;&#10;Describe your agent's personality, tone, and behavior..."
      />

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{content.length} chars</span>
          {modified && (
            <span>
              Modified{" "}
              {new Date(modified).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
