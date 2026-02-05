import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateConfigSchema = z.object({
  mode: z.enum(["DRAFT_ONLY", "ASK_FIRST"]).optional(),
  skills: z
    .object({
      enabled: z.array(z.string()).optional(),
      disabled: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * POST /api/deployments/[projectId]/update-config
 *
 * Updates configuration on the running dashboard.
 * - Mode change: Regenerates AGENTS.md from template
 * - Skills: Updates enabled/disabled skills
 *
 * Body: { mode?: "DRAFT_ONLY" | "ASK_FIRST", skills?: { enabled: [...], disabled: [...] } }
 *
 * Response:
 *   200: { success: true, changes: [...] }
 *   400: { error: "..." }
 *   401: { error: "Unauthorized" }
 *   404: { error: "..." }
 *   500: { error: "..." }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { mode, skills } = parsed.data;
  const { projectId } = await params;

  if (!mode && !skills) {
    return NextResponse.json(
      { error: "No changes specified" },
      { status: 400 }
    );
  }

  // Find the project and deployment
  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: { deployment: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.deployment) {
    return NextResponse.json(
      { error: "No deployment found for this project" },
      { status: 404 }
    );
  }

  const deployment = project.deployment;

  if (deployment.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Deployment is not active" },
      { status: 400 }
    );
  }

  // Check for admin secret
  const heartbeatData = deployment.heartbeatData as {
    adminSecret?: string;
  } | null;

  const adminSecret = heartbeatData?.adminSecret;
  if (!adminSecret) {
    return NextResponse.json(
      {
        error:
          "Config update not available. Redeploy to enable this feature.",
      },
      { status: 400 }
    );
  }

  // Determine the dashboard URL
  const dashboardUrl = deployment.subdomain
    ? `https://${deployment.subdomain}.capable.ai`
    : deployment.dropletIp
      ? `http://${deployment.dropletIp}:3100`
      : null;

  if (!dashboardUrl) {
    return NextResponse.json(
      { error: "Cannot determine dashboard URL" },
      { status: 500 }
    );
  }

  // Call the dashboard's admin endpoint to update config
  let changes: string[] = [];
  try {
    const response = await fetch(`${dashboardUrl}/api/admin/update-config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": adminSecret,
      },
      body: JSON.stringify({ mode, skills }),
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error || `Dashboard returned ${response.status}`
      );
    }

    const data = await response.json();
    changes = data.changes || [];
  } catch (err) {
    console.error("Failed to update config on dashboard:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to contact dashboard. Is it running?",
      },
      { status: 500 }
    );
  }

  // Update the mode in our database if it changed
  if (mode) {
    await db.project.update({
      where: { id: projectId },
      data: {
        mode: mode,
      },
    });
  }

  return NextResponse.json({ success: true, changes });
}
