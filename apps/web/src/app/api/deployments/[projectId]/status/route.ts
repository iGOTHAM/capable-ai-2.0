import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const deployment = await db.deployment.findFirst({
    where: {
      projectId,
      project: { userId: user.id },
    },
  });

  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    status: deployment.status,
    dropletIp: deployment.dropletIp,
    lastHeartbeatAt: deployment.lastHeartbeatAt?.toISOString() ?? null,
    activePackVer: deployment.activePackVer,
  });
}
