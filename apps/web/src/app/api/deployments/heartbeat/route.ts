import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
} from "@/lib/cloudflare-dns";
import {
  encryptHeartbeatCredentials,
  decryptCredential,
} from "@/lib/deployment-credentials";
import { sendDeploymentReadyEmail } from "@/lib/email";

const heartbeatSchema = z.object({
  projectToken: z.string().min(1),
  dropletIp: z.string().optional(),
  packVersion: z.number().optional(),
  status: z.enum(["active", "provisioning", "stopping"]).default("active"),
  dashboardPassword: z.string().optional(),
  adminSecret: z.string().optional(),
  gatewayToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { projectToken, dropletIp, packVersion, status, dashboardPassword, adminSecret, gatewayToken } =
    parsed.data;

  const deployment = await db.deployment.findUnique({
    where: { projectToken },
  });

  if (!deployment) {
    return NextResponse.json(
      { error: "Invalid project token" },
      { status: 404 },
    );
  }

  const newStatus =
    status === "stopping"
      ? "DEACTIVATED"
      : status === "provisioning"
        ? "PROVISIONING"
        : "ACTIVE";
  const currentIp = dropletIp ?? deployment.dropletIp;

  // Preserve existing credentials if not provided in this heartbeat.
  // Existing data may be encrypted (new format) or plaintext (legacy).
  // When preserving, we decrypt first so we always re-encrypt consistently.
  const existingData = deployment.heartbeatData as Record<string, unknown> | null;
  const password = dashboardPassword
    ?? (typeof existingData?.dashboardPassword === "string"
      ? decryptCredential(existingData.dashboardPassword)
      : null);
  const secret = adminSecret
    ?? (typeof existingData?.adminSecret === "string"
      ? decryptCredential(existingData.adminSecret)
      : null);
  const gwToken = gatewayToken
    ?? (typeof existingData?.gatewayToken === "string"
      ? decryptCredential(existingData.gatewayToken)
      : null);

  // Build heartbeatData with plaintext credentials, then encrypt sensitive fields
  const rawHeartbeatData: Record<string, unknown> = {
    receivedAt: new Date().toISOString(),
    reportedStatus: status,
    ip: dropletIp,
    ...(password ? { dashboardPassword: password } : {}),
    ...(secret ? { adminSecret: secret } : {}),
    ...(gwToken ? { gatewayToken: gwToken } : {}),
  };

  // Update deployment record first — encrypt credentials before writing to DB
  await db.deployment.update({
    where: { id: deployment.id },
    data: {
      status: newStatus,
      lastHeartbeatAt: new Date(),
      dropletIp: currentIp,
      activePackVer: packVersion ?? deployment.activePackVer,
      heartbeatData: encryptHeartbeatCredentials(rawHeartbeatData) as Record<string, string>,
    },
  });

  // --- Email notification when deployment becomes ACTIVE (best-effort) ---
  if (newStatus === "ACTIVE" && deployment.status !== "ACTIVE") {
    try {
      const project = await db.project.findUnique({
        where: { id: deployment.projectId },
        include: { user: { select: { email: true } } },
      });

      if (project?.user?.email) {
        const dashboardUrl = deployment.subdomain
          ? `https://${deployment.subdomain}.capable.ai`
          : currentIp
            ? `http://${currentIp}:3100`
            : "https://capable.ai/projects";

        await sendDeploymentReadyEmail(
          project.user.email,
          project.name,
          dashboardUrl,
        );
      }
    } catch (err) {
      console.error("Failed to send deployment-ready email:", err);
    }
  }

  // --- DNS management (best-effort, don't fail the heartbeat) ---
  try {
    const hasCloudflareConfig =
      process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID;

    if (hasCloudflareConfig && deployment.subdomain && currentIp) {
      if (status === "stopping" && deployment.cloudflareRecordId) {
        // Droplet is shutting down — delete the DNS record
        await deleteDnsRecord(deployment.cloudflareRecordId);
        await db.deployment.update({
          where: { id: deployment.id },
          data: { cloudflareRecordId: null },
        });
      } else if (status === "active") {
        if (!deployment.cloudflareRecordId) {
          // First heartbeat with a subdomain — create the DNS A record
          const recordId = await createDnsRecord(
            deployment.subdomain,
            currentIp,
          );
          await db.deployment.update({
            where: { id: deployment.id },
            data: { cloudflareRecordId: recordId },
          });
        } else if (deployment.dropletIp !== currentIp) {
          // IP changed (or was null after reset) — update the existing DNS record
          await updateDnsRecord(deployment.cloudflareRecordId, currentIp);
        }
      }
    }
  } catch (err) {
    // Log but don't fail the heartbeat — DNS is best-effort
    console.error("DNS management error during heartbeat:", err);
  }

  return NextResponse.json({ ok: true });
}
