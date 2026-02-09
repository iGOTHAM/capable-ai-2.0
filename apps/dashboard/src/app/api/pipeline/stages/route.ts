import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { StageSchema, updateStages, slugify } from "@/lib/pipeline";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateStagesSchema = z.object({
  stages: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string().min(1).max(100),
    }),
  ).min(1, "At least one stage is required"),
});

/**
 * PUT /api/pipeline/stages
 * Update the pipeline stages. If a stage ID is not provided, one is auto-generated.
 * Projects in removed stages are moved to the first remaining stage.
 */
export async function PUT(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = UpdateStagesSchema.parse(body);

    // Ensure all stages have IDs
    const stages = parsed.stages.map((s) => ({
      id: s.id || slugify(s.label),
      label: s.label,
    }));

    const updated = await updateStages(stages);
    return NextResponse.json({ stages: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.errors },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to update stages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
