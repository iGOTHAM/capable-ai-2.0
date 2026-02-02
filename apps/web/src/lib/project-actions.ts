"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { db } from "./db";
import { z } from "zod";
import { canCreateProject } from "./subscription-guard";
import { generatePackFiles } from "./pack-generator";
import { DEFAULT_CONFIG_PATCH } from "@capable-ai/shared";
import type { TemplateId, PersonalityTone } from "@capable-ai/shared";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

const createProjectSchema = z.object({
  botName: z
    .string()
    .min(3, "Bot name must be at least 3 characters")
    .max(32, "Bot name must be at most 32 characters")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "Bot name must be lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)",
    ),
  userName: z.string().optional(),
  userRole: z.string().optional(),
  personality: z
    .enum(["professional", "casual", "direct", "friendly"])
    .default("professional"),
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  templateId: z.enum(["pe", "legal", "healthcare", "general"]),
  mode: z.enum(["DRAFT_ONLY", "ASK_FIRST"]),
  neverRules: z.array(z.string()),
});

export type CreateProjectResult = {
  error?: string;
  projectId?: string;
};

export async function createProject(data: {
  botName: string;
  userName?: string;
  userRole?: string;
  personality?: string;
  name: string;
  description: string;
  templateId: string;
  mode: string;
  neverRules: string[];
}): Promise<CreateProjectResult> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Check subscription
  const subscriptionCheck = await canCreateProject(user.id);
  if (!subscriptionCheck.allowed) {
    return { error: subscriptionCheck.reason || "Cannot create project" };
  }

  const parsed = createProjectSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  // Check subdomain availability
  const existingSubdomain = await db.deployment.findUnique({
    where: { subdomain: parsed.data.botName },
  });
  if (existingSubdomain) {
    return { error: "This bot name is already taken. Please choose another." };
  }

  // Create project with new fields
  const project = await db.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      templateId: parsed.data.templateId,
      mode: parsed.data.mode,
      neverRules: parsed.data.neverRules,
      botName: parsed.data.botName,
      userName: parsed.data.userName || null,
      userRole: parsed.data.userRole || null,
      personality: parsed.data.personality,
    },
  });

  // Generate pack v1 inline (no more payment gating)
  const files = generatePackFiles({
    templateId: parsed.data.templateId as TemplateId,
    mode: parsed.data.mode,
    description: parsed.data.description,
    neverRules: parsed.data.neverRules,
    botName: parsed.data.botName,
    userName: parsed.data.userName,
    userRole: parsed.data.userRole,
    personality: parsed.data.personality as PersonalityTone,
  });

  await db.packVersion.create({
    data: {
      projectId: project.id,
      version: 1,
      files,
      configPatch: DEFAULT_CONFIG_PATCH as unknown as Prisma.JsonObject,
      changelog: "Initial pack generation",
    },
  });

  // Create deployment record with subdomain
  await db.deployment.create({
    data: {
      projectId: project.id,
      projectToken: crypto.randomBytes(32).toString("hex"),
      status: "PENDING",
      subdomain: parsed.data.botName,
    },
  });

  return { projectId: project.id };
}
