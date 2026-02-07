import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
} from "@/lib/cloudflare-dns";

const heartbeatSchema = z.object({
  projectToken: z.string().min(1),
  dropletIp: z.string().optional(),
  packVersion: z.number().optional(),
  status: z.enum(["active", "stopping"]).default("active"),
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

  const newStatus = status === "stopping" ? "DEACTIVATED" : "ACTIVE";
  const currentIp = dropletIp ?? deployment.dropletIp;

  // Preserve existing credentials if not provided in this heartbeat
  const existingData = deployment.heartbeatData as Record<string, unknown> | null;
  const password = dashboardPassword ?? existingData?.dashboardPassword ?? null;
  const secret = adminSecret ?? existingData?.adminSecret ?? null;
  const gwToken = gatewayToken ?? existingData?.gatewayToken ?? null;

  // Update deployment record first
  await db.deployment.update({
    where: { id: deployment.id },
    data: {
      status: newStatus,
      lastHeartbeatAt: new Date(),
      dropletIp: currentIp,
      activePackVer: packVersion ?? deployment.activePackVer,
      heartbeatData: {
        receivedAt: new Date().toISOString(),
        reportedStatus: status,
        ip: dropletIp,
        ...(password ? { dashboardPassword: password } : {}),
        ...(secret ? { adminSecret: secret } : {}),
        ...(gwToken ? { gatewayToken: gwToken } : {}),
      },
    },
  });

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
