"use client";

import { cn } from "@/lib/utils";
import type { Project } from "@/lib/pipeline";

// Re-export for backward compatibility
export type { Project } from "@/lib/pipeline";

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-accent hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
    >
      <h3 className="text-[15px] font-semibold leading-tight">
        {project.name}
      </h3>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight">
          {project.metric.value}
        </span>
        <span className="text-xs text-muted-foreground">
          {project.metric.label}
        </span>
      </div>

      <div className="mt-3">
        <span className="inline-block rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
          {project.category}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span
          className={cn(
            "flex items-center gap-1",
            project.flagStatus === "warning" && "text-amber-500",
            project.flagStatus === "clean" && "text-green-500",
          )}
        >
          {project.flagStatus === "warning" && (
            <>
              <span>&#x26A0;&#xFE0F;</span> {project.flagLabel}
            </>
          )}
          {project.flagStatus === "clean" && (
            <>
              <span>&#x2713;</span> {project.flagLabel}
            </>
          )}
          {project.flagStatus === "info" && (
            <>
              <span>&#x1F4C4;</span> {project.flagLabel}
            </>
          )}
        </span>
        <span>
          {project.taskCount} task{project.taskCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
