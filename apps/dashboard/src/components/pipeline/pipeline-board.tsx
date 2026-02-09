"use client";

import { useRouter } from "next/navigation";
import { STAGES, DEMO_PROJECTS } from "@/lib/demo-data";
import { ProjectCard } from "./project-card";

export function PipelineBoard() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {STAGES.map((stage) => {
        const stageProjects = DEMO_PROJECTS.filter(
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
