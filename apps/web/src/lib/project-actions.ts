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
import { destroyDroplet } from "./digitalocean";
import { deleteDnsRecord } from "./cloudflare-dns";
import { decrypt } from "./encryption";

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
  templateId: z.enum(["pe", "realestate", "general"]),
  neverRules: z.array(z.string()),
  provider: z.enum(["anthropic", "openai"]).optional(),
  model: z.string().optional(),
  businessContext: z.record(z.string()).optional(),
  customKnowledge: z
    .array(z.object({ filename: z.string(), content: z.string() }))
    .optional(),
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
  neverRules: string[];
  provider?: string;
  model?: string;
  businessContext?: Record<string, string>;
  customKnowledge?: { filename: string; content: string }[];
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
      neverRules: parsed.data.neverRules,
      botName: parsed.data.botName,
      userName: parsed.data.userName || null,
      userRole: parsed.data.userRole || null,
      personality: parsed.data.personality,
      provider: parsed.data.provider ?? null,
      aiModel: parsed.data.model ?? null,
      businessContext: parsed.data.businessContext ?? undefined,
    },
  });

  // Generate pack v1 inline (no more payment gating)
  const files = generatePackFiles({
    templateId: parsed.data.templateId as TemplateId,
    description: parsed.data.description,
    neverRules: parsed.data.neverRules,
    botName: parsed.data.botName,
    userName: parsed.data.userName,
    userRole: parsed.data.userRole,
    personality: parsed.data.personality as PersonalityTone,
    businessContext: parsed.data.businessContext,
    customKnowledge: parsed.data.customKnowledge,
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

/**
 * Delete a project and clean up all associated infrastructure.
 * Destroys DO droplet + DNS record, then cascade-deletes
 * PackVersions, Deployment, and Payments via Prisma.
 */
export async function deleteProject(
  projectId: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: { deployment: true },
  });

  if (!project) return { error: "Project not found" };

  // Clean up infrastructure if deployment exists
  if (project.deployment) {
    const deployment = project.deployment;

    // Destroy DO droplet if auto-deployed
    if (deployment.dropletId && deployment.deployMethod === "auto") {
      const doAccount = await db.digitalOceanAccount.findUnique({
        where: { userId: user.id },
      });

      if (doAccount) {
        try {
          const token = decrypt(doAccount.accessToken);
          await destroyDroplet(token, deployment.dropletId);
        } catch (err) {
          console.error("Failed to destroy droplet during project deletion:", err);
        }
      }
    }

    // Delete Cloudflare DNS record
    if (deployment.cloudflareRecordId) {
      try {
        await deleteDnsRecord(deployment.cloudflareRecordId);
      } catch (err) {
        console.error("Failed to delete DNS record during project deletion:", err);
      }
    }
  }

  // Delete the project — cascades handle PackVersion, Deployment, Payment
  await db.project.delete({
    where: { id: projectId },
  });

  return {};
}

const updateProjectSchema = z.object({
  description: z.string().min(1, "Description is required").optional(),
  personality: z
    .enum(["professional", "casual", "direct", "friendly"])
    .optional(),
  userName: z.string().optional(),
  userRole: z.string().optional(),
  neverRules: z.array(z.string()).optional(),
  businessContext: z.record(z.string()).optional(),
});

export type UpdateProjectResult = {
  error?: string;
  success?: boolean;
};

export async function updateProject(
  projectId: string,
  data: {
    description?: string;
    personality?: string;
    userName?: string;
    userRole?: string;
    neverRules?: string[];
    businessContext?: Record<string, string>;
  },
): Promise<UpdateProjectResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
  });

  if (!project) return { error: "Project not found" };

  const parsed = updateProjectSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.personality !== undefined)
    updates.personality = parsed.data.personality;
  if (parsed.data.userName !== undefined)
    updates.userName = parsed.data.userName || null;
  if (parsed.data.userRole !== undefined)
    updates.userRole = parsed.data.userRole || null;
  if (parsed.data.neverRules !== undefined)
    updates.neverRules = parsed.data.neverRules;
  if (parsed.data.businessContext !== undefined)
    updates.businessContext = parsed.data.businessContext;

  if (Object.keys(updates).length === 0) {
    return { success: true };
  }

  await db.project.update({
    where: { id: projectId },
    data: updates,
  });

  return { success: true };
}
