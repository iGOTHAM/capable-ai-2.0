import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const setKeySchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

/**
 * POST /api/deployments/[projectId]/set-key
 *
 * Proxy route: browser → our server → droplet.
 * Forwards LLM credentials to the dashboard's admin endpoint.
 * The API key passes through but is NOT stored in our database.
 *
 * Body: { provider, apiKey, model }
 * Response: { success: true } or { error: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = setKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
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
      { error: "No deployment found" },
      { status: 404 }
    );
  }

  const deployment = project.deployment;

  if (deployment.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Deployment is not active yet" },
      { status: 400 }
    );
  }

  // Get admin secret from heartbeat data
  const heartbeatData = deployment.heartbeatData as {
    adminSecret?: string;
  } | null;

  const adminSecret = heartbeatData?.adminSecret;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin secret not available. Redeploy to enable this feature." },
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

  // Forward the key to the dashboard's admin endpoint (try each URL)
  let lastError: unknown;
  for (const dashboardUrl of urls) {
    try {
      const response = await fetch(`${dashboardUrl}/api/admin/set-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": adminSecret,
        },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Dashboard returned ${response.status}`
        );
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error(`Failed to set key via ${dashboardUrl}:`, err);
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
