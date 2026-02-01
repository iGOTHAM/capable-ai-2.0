import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const heartbeatSchema = z.object({
  projectToken: z.string().min(1),
  dropletIp: z.string().optional(),
  packVersion: z.number().optional(),
  status: z.enum(["active", "stopping"]).default("active"),
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

  const { projectToken, dropletIp, packVersion, status } = parsed.data;

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

  await db.deployment.update({
    where: { id: deployment.id },
    data: {
      status: newStatus,
      lastHeartbeatAt: new Date(),
      dropletIp: dropletIp ?? deployment.dropletIp,
      activePackVer: packVersion ?? deployment.activePackVer,
      heartbeatData: {
        receivedAt: new Date().toISOString(),
        reportedStatus: status,
        ip: dropletIp,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
