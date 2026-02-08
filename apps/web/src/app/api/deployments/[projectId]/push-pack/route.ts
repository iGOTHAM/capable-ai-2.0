import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/deployments/[projectId]/push-pack
 *
 * Pushes the latest pack version to the running dashboard.
 * Downloads pack files from DB and sends them to the dashboard's update-pack endpoint.
 *
 * Response:
 *   200: { success: true, version: number }
 *   400: { error: "..." }
 *   401: { error: "Unauthorized" }
 *   404: { error: "..." }
 *   500: { error: "..." }
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

  // Find the project with deployment and latest pack version
  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      deployment: true,
      packVersions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
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

  // Get the latest pack version
  const latestPack = project.packVersions[0];
  if (!latestPack) {
    return NextResponse.json(
      { error: "No pack version found for this project" },
      { status: 404 }
    );
  }

  // Check if already at latest version
  if (deployment.activePackVer === latestPack.version) {
    return NextResponse.json(
      { error: "Already at latest version", version: latestPack.version },
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
          "Pack push not available. Redeploy to enable this feature.",
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

  // Get pack files
  const files = latestPack.files as Record<string, string>;

  // Call the dashboard's admin endpoint to update the pack (try each URL)
  let lastError: unknown;
  for (const dashboardUrl of urls) {
    try {
      const response = await fetch(`${dashboardUrl}/api/admin/update-pack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": adminSecret,
        },
        body: JSON.stringify({
          files,
          version: latestPack.version,
        }),
        // Timeout after 30 seconds (pack files can be large)
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Dashboard returned ${response.status}`
        );
      }

      // Success — update the active pack version in our database
      await db.deployment.update({
        where: { id: deployment.id },
        data: {
          activePackVer: latestPack.version,
        },
      });

      return NextResponse.json({
        success: true,
        version: latestPack.version,
      });
    } catch (err) {
      console.error(`Failed to push pack via ${dashboardUrl}:`, err);
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
