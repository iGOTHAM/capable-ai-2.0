"use client";

import { ProjectCard, type Project } from "./project-card";

interface Stage {
  id: string;
  label: string;
}

const STAGES: Stage[] = [
  { id: "sourcing", label: "Sourcing" },
  { id: "underwriting", label: "Underwriting" },
  { id: "due-diligence", label: "Due Diligence" },
  { id: "under-contract", label: "Under Contract" },
];

const DEMO_PROJECTS: Project[] = [
  {
    id: "1",
    name: "Riverside Apartments",
    stage: "sourcing",
    metric: { label: "NOI", value: "$4.2M" },
    category: "Multifamily",
    flags: 2,
    flagStatus: "warning",
    flagLabel: "2 flags",
    taskCount: 3,
  },
  {
    id: "2",
    name: "Oak Street Office",
    stage: "sourcing",
    metric: { label: "NOI", value: "$1.8M" },
    category: "Office",
    flags: 0,
    flagStatus: "clean",
    flagLabel: "Clean",
    taskCount: 1,
  },
  {
    id: "3",
    name: "Harbor Industrial",
    stage: "sourcing",
    metric: { label: "NOI", value: "$3.5M" },
    category: "Industrial",
    flags: 0,
    flagStatus: "info",
    flagLabel: "New docs",
    taskCount: 5,
  },
  {
    id: "4",
    name: "Metro Retail Center",
    stage: "underwriting",
    metric: { label: "NOI", value: "$2.1M" },
    category: "Retail",
    flags: 1,
    flagStatus: "warning",
    flagLabel: "1 flag",
    taskCount: 4,
  },
  {
    id: "5",
    name: "Sunset Medical",
    stage: "underwriting",
    metric: { label: "NOI", value: "$890K" },
    category: "Medical Office",
    flags: 0,
    flagStatus: "clean",
    flagLabel: "Clean",
    taskCount: 2,
  },
  {
    id: "6",
    name: "Gateway Business Park",
    stage: "due-diligence",
    metric: { label: "NOI", value: "$5.8M" },
    category: "Industrial",
    flags: 0,
    flagStatus: "info",
    flagLabel: "LOI Due Fri",
    taskCount: 8,
  },
];

export function PipelineBoard() {
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
                  <ProjectCard key={project.id} project={project} />
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
