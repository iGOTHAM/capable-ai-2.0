import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { CreateProjectSchema, createProject } from "@/lib/pipeline";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * POST /api/pipeline/projects
 * Create a new project in the pipeline.
 */
export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = CreateProjectSchema.parse(body);
    const project = await createProject(input);
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.errors },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
