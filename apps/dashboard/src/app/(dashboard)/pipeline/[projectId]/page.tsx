"use client";

import { use } from "react";
import { ProjectDetailView } from "@/components/pipeline/project-detail";
import { getProjectById, getProjectSummary } from "@/lib/demo-data";

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const detail = getProjectById(projectId);
  const summary = getProjectSummary(projectId);

  if (!detail) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="text-5xl">🏗️</div>
        <p className="text-lg font-semibold">Project not found</p>
        <a
          href="/pipeline"
          className="text-sm text-primary hover:underline"
        >
          ← Back to Projects
        </a>
      </div>
    );
  }

  return <ProjectDetailView detail={detail} summary={summary} />;
}
