import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSignedToken } from "@capable-ai/shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = await request.json();
  const version = body.version as number | undefined;
  const projectToken = body.projectToken as string | undefined;

  let verifiedProjectId: string | null = null;

  // Auth path 1: Session-based (browser user)
  const user = await getCurrentUser();
  if (user) {
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: {
        payments: { where: { status: "COMPLETED" }, take: 1 },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.payments.length === 0) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    verifiedProjectId = project.id;
  }

  // Auth path 2: projectToken (VPS cloud-init script)
  if (!verifiedProjectId && projectToken) {
    const deployment = await db.deployment.findUnique({
      where: { projectToken },
      include: {
        project: {
          include: {
            payments: { where: { status: "COMPLETED" }, take: 1 },
          },
        },
      },
    });

    if (!deployment || deployment.project.id !== projectId) {
      return NextResponse.json({ error: "Invalid project token" }, { status: 401 });
    }

    if (deployment.project.payments.length === 0) {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    verifiedProjectId = deployment.project.id;
  }

  // Neither auth method worked
  if (!verifiedProjectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the requested pack version (or latest)
  const packVersion = version
    ? await db.packVersion.findFirst({
        where: { projectId, version },
      })
    : await db.packVersion.findFirst({
        where: { projectId },
        orderBy: { version: "desc" },
      });

  if (!packVersion) {
    return NextResponse.json(
      { error: "Pack version not found" },
      { status: 404 },
    );
  }

  const secret = process.env.PACK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Token valid for 1 hour
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  const token = generateSignedToken(
    { projectId, packVersion: packVersion.version, expiresAt },
    secret,
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const downloadUrl = `${appUrl}/api/packs/${projectId}/download?token=${token}`;

  return NextResponse.json({ url: downloadUrl, expiresAt });
}
