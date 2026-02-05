import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const setPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * POST /api/deployments/[projectId]/set-password
 *
 * Sets a user-chosen password on the running dashboard.
 * Requires the deployment to have an adminSecret (set during deploy).
 *
 * Body: { "password": "<new-password>" }
 *
 * Response:
 *   200: { "success": true }
 *   400: { "error": "..." }
 *   401: { "error": "Unauthorized" }
 *   404: { "error": "..." }
 *   500: { "error": "..." }
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

  const parsed = setPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { password } = parsed.data;
  const { projectId } = await params;

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
    dashboardPassword?: string;
  } | null;

  const adminSecret = heartbeatData?.adminSecret;
  if (!adminSecret) {
    return NextResponse.json(
      {
        error:
          "Password change not available. Redeploy to enable this feature.",
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

  // Call the dashboard's admin endpoint to set the new password
  try {
    const response = await fetch(`${dashboardUrl}/api/admin/set-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": adminSecret,
      },
      body: JSON.stringify({ password }),
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error || `Dashboard returned ${response.status}`
      );
    }
  } catch (err) {
    console.error("Failed to set password on dashboard:", err);
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

  // Update the password in our database
  await db.deployment.update({
    where: { id: deployment.id },
    data: {
      heartbeatData: {
        ...heartbeatData,
        dashboardPassword: password,
      },
    },
  });

  return NextResponse.json({ success: true });
}
