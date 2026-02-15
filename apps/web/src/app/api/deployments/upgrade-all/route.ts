import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDecryptedCredentials } from "@/lib/deployment-credentials";

/**
 * POST /api/deployments/upgrade-all
 *
 * Auto-deploy endpoint: upgrades all active VPS dashboards to the latest build.
 * Called by GitHub Actions after a successful dashboard tarball build.
 *
 * Auth: Bearer token via DEPLOY_SECRET env var (set as GitHub Actions secret)
 * Body: { tarballUrl?: string } — defaults to the latest GitHub release URL
 */
export async function POST(req: NextRequest) {
  const deploySecret = process.env.DEPLOY_SECRET;
  if (!deploySecret) {
    return NextResponse.json(
      { error: "DEPLOY_SECRET not configured" },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${deploySecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tarballUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Use default URL
  }

  const tarballUrl =
    body.tarballUrl ||
    "https://github.com/iGOTHAM/capable-ai-2.0/releases/download/dashboard-latest/dashboard-standalone.tar.gz";

  // Find all active deployments
  const deployments = await db.deployment.findMany({
    where: { status: "ACTIVE" },
    include: { project: { select: { name: true } } },
  });

  if (deployments.length === 0) {
    return NextResponse.json({ message: "No active deployments", results: [] });
  }

  const results: Array<{
    name: string;
    subdomain: string | null;
    url: string;
    status: string;
    error?: string;
  }> = [];

  for (const deployment of deployments) {
    const heartbeatData = deployment.heartbeatData as Record<
      string,
      unknown
    > | null;
    const { adminSecret } = getDecryptedCredentials(heartbeatData);

    if (!adminSecret) {
      results.push({
        name: deployment.project.name,
        subdomain: deployment.subdomain,
        url: "",
        status: "skipped",
        error: "No admin secret",
      });
      continue;
    }

    // Try HTTPS subdomain first, then direct IP
    const urls: string[] = [];
    if (deployment.subdomain)
      urls.push(`https://${deployment.subdomain}.capable.ai`);
    if (deployment.dropletIp)
      urls.push(`http://${deployment.dropletIp}:3100`);

    let upgraded = false;
    for (const baseUrl of urls) {
      try {
        const resp = await fetch(`${baseUrl}/api/admin/upgrade-dashboard`, {
          method: "POST",
          headers: {
            "X-Admin-Secret": adminSecret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tarballUrl }),
          signal: AbortSignal.timeout(120000), // 2 min timeout for download + extract
        });

        // The upgrade endpoint may kill itself during restart, so any response is good
        const data = await resp.json().catch(() => ({
          rawStatus: resp.status,
        }));

        results.push({
          name: deployment.project.name,
          subdomain: deployment.subdomain,
          url: baseUrl,
          status: resp.ok ? "upgraded" : "error",
          error: resp.ok ? undefined : JSON.stringify(data),
        });
        upgraded = true;
        break;
      } catch (err) {
        // Connection reset is expected — the dashboard restarts itself
        const msg =
          err instanceof Error ? err.message : String(err);
        if (
          msg.includes("ECONNRESET") ||
          msg.includes("fetch failed") ||
          msg.includes("network error") ||
          msg.includes("AbortError")
        ) {
          results.push({
            name: deployment.project.name,
            subdomain: deployment.subdomain,
            url: baseUrl,
            status: "restarting",
          });
          upgraded = true;
          break;
        }
        // Try next URL
        continue;
      }
    }

    if (!upgraded) {
      results.push({
        name: deployment.project.name,
        subdomain: deployment.subdomain,
        url: urls.join(", "),
        status: "unreachable",
        error: "Could not connect to any URL",
      });
    }
  }

  return NextResponse.json({
    message: `Processed ${deployments.length} deployment(s)`,
    results,
  });
}
