import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDecryptedCredentials } from "@/lib/deployment-credentials";

/**
 * GET /api/deployments/[projectId]/key-status
 *
 * Proxy route: browser → our server → droplet.
 * Checks whether an LLM API key is already configured on the droplet,
 * so the deploy page can skip the "Connect AI" form if the key
 * was already sent (e.g., from the wizard's sessionStorage auto-send).
 *
 * Response: { configured: boolean, provider?: "anthropic" | "openai" }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: { deployment: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.deployment) {
    return NextResponse.json(
      { error: "No deployment found" },
      { status: 404 },
    );
  }

  const deployment = project.deployment;

  if (deployment.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Deployment is not active yet" },
      { status: 400 },
    );
  }

  // Get admin secret from heartbeat data (decrypt from DB)
  const heartbeatData = deployment.heartbeatData as Record<string, unknown> | null;
  const { adminSecret } = getDecryptedCredentials(heartbeatData);
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin secret not available" },
      { status: 400 },
    );
  }

  // Determine dashboard URLs to try (HTTPS subdomain first, then direct IP)
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
      { status: 500 },
    );
  }

  // Query the dashboard's key-status endpoint
  let lastError: unknown;
  for (const dashboardUrl of urls) {
    try {
      const response = await fetch(
        `${dashboardUrl}/api/admin/key-status`,
        {
          method: "GET",
          headers: {
            "X-Admin-Secret": adminSecret,
          },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Dashboard returned ${response.status}`,
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (err) {
      console.error(`Failed to check key status via ${dashboardUrl}:`, err);
      lastError = err;
    }
  }

  return NextResponse.json(
    {
      error:
        lastError instanceof Error
          ? lastError.message
          : "Failed to contact dashboard",
    },
    { status: 500 },
  );
}
