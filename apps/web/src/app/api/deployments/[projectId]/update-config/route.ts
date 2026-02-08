import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateConfigSchema = z.object({
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
 * Updates configuration on the running deployment.
 * - Skills: Updates enabled/disabled skills
 *
 * Body: { skills?: { enabled: [...], disabled: [...] } }
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

  const { skills } = parsed.data;
  const { projectId } = await params;

  if (!skills) {
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

  // Determine dashboard URLs to try (HTTPS subdomain first, then direct IP fallback)
  const urls: string[] = [];
  if (deployment.subdomain) {
    urls.push(`https://${deployment.subdomain}.capable.ai`);
  }
  if (deployment.dropletIp) {
    urls.push(`http://${deployment.dropletIp}:3100`);
  }

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "Cannot determine dashboard URL" },
      { status: 500 }
    );
  }

  // Call the dashboard's admin endpoint to update config (try each URL)
  let lastError: unknown;
  for (const dashboardUrl of urls) {
    try {
      const response = await fetch(`${dashboardUrl}/api/admin/update-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": adminSecret,
        },
        body: JSON.stringify({ skills }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Dashboard returned ${response.status}`
        );
      }

      const data = await response.json();
      const changes = data.changes || [];

      return NextResponse.json({ success: true, changes });
    } catch (err) {
      console.error(`Failed to update config via ${dashboardUrl}:`, err);
      lastError = err;
    }
  }

  return NextResponse.json(
    {
      error:
        lastError instanceof Error
          ? lastError.message
          : "Failed to contact dashboard. Is it running?",
    },
    { status: 500 }
  );
}
