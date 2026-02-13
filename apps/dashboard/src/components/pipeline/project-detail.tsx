"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Circle,
  StickyNote,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, Stage } from "@/lib/pipeline";
import { ProjectDocumentsTab } from "./project-documents-tab";
import { ProjectTasksTab } from "./project-tasks-tab";
import { ProjectNotesTab } from "./project-notes-tab";
import { ProjectActivityTab } from "./project-activity-tab";

interface ProjectDetailViewProps {
  detail: Project;
  stages: Stage[];
}

const SUB_TABS = ["Overview", "Documents", "Tasks", "Notes", "Activity"] as const;
type SubTab = (typeof SUB_TABS)[number];

export function ProjectDetailView({ detail, stages }: ProjectDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SubTab>("Overview");
  const [nextSteps, setNextSteps] = useState(detail.nextSteps);
  const [stage, setStage] = useState(detail.stage);
  const [deleting, setDeleting] = useState(false);

  const persistProject = useCallback(
    async (patch: Record<string, unknown>) => {
      try {
        await fetch(`/api/pipeline/projects/${detail.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } catch {
        // Silent — optimistic UI
      }
    },
    [detail.id],
  );

  const toggleStep = (index: number) => {
    setNextSteps((prev) => {
      const updated = prev.map((step, i) =>
        i === index ? { ...step, done: !step.done } : step,
      );
      persistProject({ nextSteps: updated });
      return updated;
    });
  };

  const handleStageChange = (newStage: string) => {
    setStage(newStage);
    persistProject({ stage: newStage });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${detail.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pipeline/projects/${detail.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/pipeline");
    } catch {
      setDeleting(false);
    }
  };

  const handleGenerateMemo = async () => {
    try {
      const res = await fetch("/api/gateway-token");
      if (!res.ok) {
        window.open("/open-chat", "_blank");
        return;
      }
      const { token } = await res.json();
      window.open(`/chat/?token=${token}`, "_blank");
    } catch {
      window.open("/open-chat", "_blank");
    }
  };

  // Latest note from the notes array
  const latestNote = detail.notes.length > 0 ? detail.notes[detail.notes.length - 1] : null;

  return (
    <div className="-m-4 flex flex-col gap-0 sm:-m-6">
      {/* Back link */}
      <div className="px-4 pt-5 sm:px-7">
        <button
          onClick={() => router.push("/pipeline")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 px-4 pt-4 pb-0 sm:flex-row sm:items-start sm:justify-between sm:px-7">
        <div>
          <h1 className="text-2xl font-bold">{detail.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.category}
            {detail.details ? ` · ${detail.details}` : ""}
            {detail.location ? ` · ${detail.location}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={stage}
            onChange={(e) => handleStageChange(e.target.value)}
            className="h-9 rounded-lg border border-border bg-muted px-3 text-sm text-foreground outline-none"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateMemo}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Generate Memo
          </button>
          <button className="h-9 rounded-lg border border-border bg-muted px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            Pass
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            title="Delete project"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="mt-4 flex items-center gap-1 overflow-x-auto px-4 scrollbar-hide sm:px-7">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4 px-4 pb-7 sm:px-7">
        {activeTab === "Overview" && (
          <div className="flex flex-col gap-6">
            {/* Metrics grid */}
            {detail.metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {detail.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-border bg-card p-5"
                  >
                    <div
                      className={cn(
                        "text-[32px] font-bold leading-none tracking-tight",
                        metric.accent && "text-primary",
                      )}
                    >
                      {metric.value}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Flags */}
            {detail.flags.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Flags</h3>
                {detail.flags.map((flag) => (
                  <div
                    key={flag.title}
                    className="flex gap-3 rounded-xl border-l-4 border-l-amber-500 border border-border bg-card p-4"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">{flag.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {flag.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Two-column bottom: Next Steps + Latest Note */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Next Steps */}
              {nextSteps.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="mb-4 text-sm font-semibold">Next Steps</h3>
                  <div className="flex flex-col gap-2.5">
                    {nextSteps.map((step, i) => (
                      <button
                        key={i}
                        onClick={() => toggleStep(i)}
                        className="flex items-center gap-3 text-left text-sm transition-colors"
                      >
                        {step.done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            step.done &&
                            "text-muted-foreground line-through",
                          )}
                        >
                          {step.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest Note */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Latest Note</h3>
                </div>
                {latestNote ? (
                  <>
                    <p className="text-sm italic text-muted-foreground leading-relaxed">
                      &ldquo;{latestNote.text}&rdquo;
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {latestNote.author}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(latestNote.timestamp).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No notes yet. Add one in the Notes tab.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Documents" && (
          <ProjectDocumentsTab projectName={detail.name} />
        )}
        {activeTab === "Tasks" && (
          <ProjectTasksTab projectName={detail.name} />
        )}
        {activeTab === "Notes" && (
          <ProjectNotesTab projectId={detail.id} />
        )}
        {activeTab === "Activity" && (
          <ProjectActivityTab projectName={detail.name} />
        )}
      </div>
    </div>
  );
}
