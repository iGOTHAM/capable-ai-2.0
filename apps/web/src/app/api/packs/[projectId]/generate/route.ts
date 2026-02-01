import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatePackFiles } from "@/lib/pack-generator";
import { DEFAULT_CONFIG_PATCH } from "@capable-ai/shared";
import type { TemplateId } from "@capable-ai/shared";
import type { Prisma } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      payments: { where: { status: "COMPLETED" }, take: 1 },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.payments.length === 0) {
    return NextResponse.json(
      { error: "Payment required before generating pack" },
      { status: 402 },
    );
  }

  // Get the latest version number
  const latestPack = await db.packVersion.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });

  const nextVersion = latestPack ? latestPack.version + 1 : 1;

  // Generate pack files
  const files = generatePackFiles({
    templateId: project.templateId as TemplateId,
    mode: project.mode,
    description: project.description,
    neverRules: project.neverRules,
  });

  // If v1 exists as a placeholder (empty files from webhook), update it
  if (latestPack && latestPack.version === 1 && Object.keys(latestPack.files as object).length === 0) {
    await db.packVersion.update({
      where: { id: latestPack.id },
      data: {
        files,
        configPatch: DEFAULT_CONFIG_PATCH as unknown as Prisma.JsonObject,
        changelog: "Initial pack generation",
      },
    });

    return NextResponse.json({ version: 1, files: Object.keys(files) });
  }

  // Create new version
  const packVersion = await db.packVersion.create({
    data: {
      projectId,
      version: nextVersion,
      files,
      configPatch: DEFAULT_CONFIG_PATCH as unknown as Prisma.JsonObject,
      changelog:
        nextVersion === 1 ? "Initial pack generation" : "Pack regenerated",
    },
  });

  return NextResponse.json({
    version: packVersion.version,
    files: Object.keys(files),
  });
}
