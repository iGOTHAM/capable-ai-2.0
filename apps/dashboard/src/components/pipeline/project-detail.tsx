"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileText,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectDetail, Project } from "@/lib/demo-data";
import { STAGES } from "@/lib/demo-data";

interface ProjectDetailViewProps {
  detail: ProjectDetail;
  summary?: Project;
}

const SUB_TABS = ["Overview", "Documents", "Tasks", "Notes", "Activity"] as const;
type SubTab = (typeof SUB_TABS)[number];

export function ProjectDetailView({ detail, summary }: ProjectDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SubTab>("Overview");
  const [nextSteps, setNextSteps] = useState(detail.nextSteps);
  const [stage, setStage] = useState(detail.stage);

  const toggleStep = (index: number) => {
    setNextSteps((prev) =>
      prev.map((step, i) =>
        i === index ? { ...step, done: !step.done } : step,
      ),
    );
  };

  return (
    <div className="-m-6 flex flex-col gap-0">
      {/* Back link */}
      <div className="px-7 pt-5">
        <button
          onClick={() => router.push("/pipeline")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 px-7 pt-4 pb-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{detail.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.category} · {detail.details} · {detail.location}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="h-9 rounded-lg border border-border bg-muted px-3 text-sm text-foreground outline-none"
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Generate Memo
          </button>
          <button className="h-9 rounded-lg border border-border bg-muted px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            Pass
          </button>
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="mt-4 flex items-center gap-1 px-7">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
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
      <div className="mt-4 px-7 pb-7">
        {activeTab === "Overview" ? (
          <div className="flex flex-col gap-6">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {detail.metrics.map((metric, i) => (
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

              {/* Latest Note */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Latest Note</h3>
                </div>
                <p className="text-sm italic text-muted-foreground leading-relaxed">
                  &ldquo;{detail.latestNote.text}&rdquo;
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {detail.latestNote.author}
                  </span>
                  <span>·</span>
                  <span>{detail.latestNote.timeAgo}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Placeholder for other tabs */
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium">{activeTab}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This section will be available once your data is connected.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
