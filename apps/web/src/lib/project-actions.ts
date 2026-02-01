"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { db } from "./db";
import { z } from "zod";

const createProjectSchema = z.object({
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

  const parsed = createProjectSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const project = await db.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      templateId: parsed.data.templateId,
      mode: parsed.data.mode,
      neverRules: parsed.data.neverRules,
    },
  });

  return { projectId: project.id };
}
