"use client";

import { use, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ProjectDetailView } from "@/components/pipeline/project-detail";
import type { Project, Stage } from "@/lib/pipeline";

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/pipeline/projects/${projectId}`),
      fetch("/api/pipeline"),
    ])
      .then(async ([projectRes, pipelineRes]) => {
        if (!projectRes.ok) {
          setNotFound(true);
          return;
        }
        const projectData = await projectRes.json();
        setProject(projectData);

        if (pipelineRes.ok) {
          const pipelineData = await pipelineRes.json();
          setStages(pipelineData.stages || []);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !project) {
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

  return <ProjectDetailView detail={project} stages={stages} />;
}
