"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProjectCard } from "./project-card";
import type { Stage, Project } from "@/lib/pipeline";

export function PipelineBoard() {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipeline")
      .then((r) => (r.ok ? r.json() : { stages: [], projects: [] }))
      .then((data) => {
        setStages(data.stages || []);
        setProjects(data.projects || []);
      })
      .catch(() => {
        setStages([]);
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
        <p className="text-sm">No pipeline stages configured.</p>
        <p className="text-xs">Go to Settings to set up your pipeline.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {stages.map((stage) => {
        const stageProjects = projects.filter(
          (p) => p.stage === stage.id,
        );
        return (
          <div key={stage.id} className="min-w-0">
            {/* Column header */}
            <div className="mb-4 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stage.label}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {stageProjects.length}
              </span>
            </div>

            {/* Project cards */}
            <div className="flex flex-col gap-3">
              {stageProjects.length > 0 ? (
                stageProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => router.push(`/pipeline/${project.id}`)}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-[13px] text-muted-foreground">
                  No projects
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
