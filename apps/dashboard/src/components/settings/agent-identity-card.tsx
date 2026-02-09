"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

export function AgentIdentityCard() {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [tagline, setTagline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/agent")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setName(data.name || "");
          setEmoji(data.emoji || "");
          setTagline(data.tagline || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emoji, tagline }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Silent
    } finally {
      setSaving(false);
    }
  };

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
      <div className="mb-1 text-lg font-semibold">Agent Identity</div>
      <p className="mb-5 text-sm text-muted-foreground">
        Customize your agent&apos;s name and appearance
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Atlas"
              maxLength={50}
              className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Emoji</label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🤖"
              maxLength={10}
              className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-center text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tagline</label>
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Your AI-powered research assistant"
            maxLength={200}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
