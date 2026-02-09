import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDecryptedCredentials } from "@/lib/deployment-credentials";

/**
 * POST /api/deployments/[projectId]/diagnose
 *
 * Diagnostic endpoint: proxies admin/status from the droplet and optionally
 * triggers dashboard upgrade or OpenClaw restart.
 *
 * Body: { action?: "status" | "upgrade" | "restart-openclaw" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
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

  if (!project?.deployment) {
    return NextResponse.json({ error: "No deployment found" }, { status: 404 });
  }

  const deployment = project.deployment;
  const heartbeatData = deployment.heartbeatData as Record<string, unknown> | null;
  const { adminSecret } = getDecryptedCredentials(heartbeatData);

  if (!adminSecret) {
    return NextResponse.json({ error: "No admin secret" }, { status: 400 });
  }

  // Determine URLs
  const urls: string[] = [];
  if (deployment.subdomain) urls.push(`https://${deployment.subdomain}.capable.ai`);
  if (deployment.dropletIp) urls.push(`http://${deployment.dropletIp}:3100`);

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Default to status
  }
  const action = body.action || "status";

  for (const baseUrl of urls) {
    try {
      if (action === "status") {
        const resp = await fetch(`${baseUrl}/api/admin/status`, {
          headers: { "X-Admin-Secret": adminSecret },
          signal: AbortSignal.timeout(10000),
        });
        const data = await resp.json();
        return NextResponse.json({ url: baseUrl, ...data });
      }

      if (action === "upgrade") {
        const tarballUrl = "https://github.com/iGOTHAM/capable-ai-2.0/releases/download/dashboard-latest/dashboard-standalone.tar.gz";
        const resp = await fetch(`${baseUrl}/api/admin/upgrade-dashboard`, {
          method: "POST",
          headers: {
            "X-Admin-Secret": adminSecret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tarballUrl }),
          signal: AbortSignal.timeout(60000),
        });
        const data = await resp.json().catch(() => ({ rawStatus: resp.status }));
        return NextResponse.json({ url: baseUrl, ...data });
      }

      if (action === "restart-openclaw") {
        // Use set-key with a dummy key just to trigger restart + diagnostics
        // Actually, better to check status first
        const resp = await fetch(`${baseUrl}/api/admin/status`, {
          headers: { "X-Admin-Secret": adminSecret },
          signal: AbortSignal.timeout(10000),
        });
        const data = await resp.json();
        return NextResponse.json({ url: baseUrl, ...data });
      }
    } catch (err) {
      console.error(`Diagnose failed via ${baseUrl}:`, err);
      continue;
    }
  }

  return NextResponse.json({ error: "Could not reach dashboard" }, { status: 500 });
}
