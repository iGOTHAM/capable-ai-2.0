import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

/**
 * POST /api/deployments/[projectId]/regenerate-password
 *
 * Generates a new dashboard password and updates it on the running droplet.
 * Requires the deployment to have an adminSecret (set during deploy).
 *
 * Response:
 *   200: { "password": "<new-password>" }
 *   400: { "error": "Password reset not available for this deployment" }
 *   401: { "error": "Unauthorized" }
 *   404: { "error": "Deployment not found" }
 *   500: { "error": "<message>" }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
          "Password reset not available. Redeploy to enable this feature.",
      },
      { status: 400 }
    );
  }

  // Generate new password (same format as cloud-init: base64, 16 bytes)
  const newPassword = randomBytes(16).toString("base64");

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
      body: JSON.stringify({ password: newPassword }),
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
        dashboardPassword: newPassword,
      },
    },
  });

  return NextResponse.json({ password: newPassword });
}
