"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Save,
  CheckCircle2,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface Stage {
  id: string;
  label: string;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function PipelineStagesCard() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pipeline")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stages) setStages(data.stages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError("");
    if (stages.length === 0) {
      setError("At least one stage is required");
      return;
    }
    if (stages.some((s) => !s.label.trim())) {
      setError("All stages must have a label");
      return;
    }

    setSaving(true);
    setSaved(false);

    // Re-generate IDs from labels
    const updated = stages.map((s) => ({
      id: slugify(s.label) || s.id,
      label: s.label.trim(),
    }));

    try {
      const res = await fetch("/api/pipeline/stages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        setStages(data.stages || updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save stages");
    } finally {
      setSaving(false);
    }
  };

  const updateLabel = (index: number, label: string) => {
    setStages((prev) =>
      prev.map((s, i) => (i === index ? { ...s, label } : s)),
    );
  };

  const removeStage = (index: number) => {
    if (stages.length <= 1) return;
    setStages((prev) => prev.filter((_, i) => i !== index));
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= stages.length) return;
    setStages((prev) => {
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex]!, arr[index]!];
      return arr;
    });
  };

  const addStage = () => {
    setStages((prev) => [
      ...prev,
      { id: `stage-${Date.now()}`, label: "" },
    ]);
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
      <div className="mb-1 text-lg font-semibold">Pipeline Stages</div>
      <p className="mb-5 text-sm text-muted-foreground">
        Customize the stages in your deal pipeline
      </p>

      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-2">
            <span className="w-6 text-center text-xs text-muted-foreground">
              {i + 1}
            </span>
            <input
              type="text"
              value={stage.label}
              onChange={(e) => updateLabel(i, e.target.value)}
              placeholder="Stage name"
              maxLength={50}
              className="h-9 flex-1 rounded-lg border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => moveStage(i, -1)}
              disabled={i === 0}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
              title="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => moveStage(i, 1)}
              disabled={i === stages.length - 1}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
              title="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => removeStage(i)}
              disabled={stages.length <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addStage}
        className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Stage
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save Stages
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
