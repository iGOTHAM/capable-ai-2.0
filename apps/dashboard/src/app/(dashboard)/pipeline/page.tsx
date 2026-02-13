"use client";

import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PageHint } from "@/components/ui/page-hint";
import { Briefcase } from "lucide-react";

export default function PipelinePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHint
        id="hint-pipeline"
        title="Project Pipeline"
        description="Track deals and projects through stages. Click any project for details, notes, and documents."
        icon={Briefcase}
      />
      <PipelineBoard />
    </div>
  );
}
