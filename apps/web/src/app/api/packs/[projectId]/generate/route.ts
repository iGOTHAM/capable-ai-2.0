import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatePackFiles } from "@/lib/pack-generator";
import { getActiveSubscription } from "@/lib/subscription-guard";
import { DEFAULT_CONFIG_PATCH, KNOWLEDGE_TEMPLATES } from "@capable-ai/shared";
import type { TemplateId, PersonalityTone } from "@capable-ai/shared";
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
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Check subscription instead of legacy one-time payment
  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return NextResponse.json(
      { error: "Active subscription required" },
      { status: 402 },
    );
  }

  // Get the latest version number
  const latestPack = await db.packVersion.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });

  const nextVersion = latestPack ? latestPack.version + 1 : 1;

  // Extract custom knowledge from previous pack (files under knowledge/ that
  // aren't the template knowledge file)
  const templateKnowledgeFilename =
    KNOWLEDGE_TEMPLATES[project.templateId as TemplateId]?.filename;
  let customKnowledge: { filename: string; content: string }[] | undefined;

  if (latestPack) {
    const prevFiles = latestPack.files as Record<string, string>;
    customKnowledge = Object.entries(prevFiles)
      .filter(
        ([name]) =>
          name.startsWith("knowledge/") && name !== templateKnowledgeFilename,
      )
      .map(([name, content]) => ({
        filename: name.replace("knowledge/", ""),
        content,
      }));
    if (customKnowledge.length === 0) customKnowledge = undefined;
  }

  // Generate pack files with ALL project data
  const files = generatePackFiles({
    templateId: project.templateId as TemplateId,
    description: project.description,
    neverRules: project.neverRules,
    botName: project.botName ?? undefined,
    userName: project.userName ?? undefined,
    userRole: project.userRole ?? undefined,
    personality: (project.personality as PersonalityTone) ?? undefined,
    businessContext:
      (project.businessContext as Record<string, string>) ?? undefined,
    customKnowledge,
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
