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

  // Get admin secret and gateway token from heartbeat data
  const heartbeatData = deployment.heartbeatData as {
    adminSecret?: string;
    gatewayToken?: string;
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

      // Forward the dashboard's full response (includes serviceStatus, journalOutput diagnostics)
      const responseData = await response.json().catch(() => ({ success: true })) as Record<string, unknown>;

      // Trigger post-install bootstrap message if gateway is active
      // This makes the agent read its knowledge files, set up cron jobs, and confirm identity
      if (responseData.serviceStatus === "active" && heartbeatData?.gatewayToken && deployment.subdomain) {
        const bootstrapMessage = [
          "You've just been deployed as a new Capable.ai agent. Complete your onboarding:",
          "",
          "1. Read all files in your knowledge/ directory and write a summary of key frameworks to MEMORY.md under a new '## Knowledge Summary' section",
          "2. Review tasks.json — confirm your pending onboarding tasks and mark onboard-002 as in-progress",
          "3. Review the 'Suggested Proactive Workflows' section in MEMORY.md — set up the recommended cron jobs using the cron tool",
          "4. Read memory/directives.md and confirm you understand your standing orders",
          "5. Write a brief 'Day 1' entry to today's daily log (memory/YYYY-MM-DD.md)",
          "",
          "Report back with: who you are, who you serve, what knowledge you have, and what cron jobs you've set up.",
        ].join("\n");

        // Fire and forget — don't block the key set response
        // Use the OpenClaw gateway chat API
        const gatewayUrl = `https://${deployment.subdomain}.capable.ai/chat/api/sessions/main/message`;
        fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${heartbeatData.gatewayToken}`,
          },
          body: JSON.stringify({ content: bootstrapMessage }),
          signal: AbortSignal.timeout(15000),
        }).catch((err) => {
          console.error("Bootstrap message failed (non-blocking):", err);
        });
      }

      return NextResponse.json({ ...responseData, bootstrapTriggered: true });
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
