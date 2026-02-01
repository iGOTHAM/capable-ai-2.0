import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySignedToken } from "@capable-ai/shared";
import archiver from "archiver";
import { PassThrough } from "stream";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const secret = process.env.PACK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const payload = verifySignedToken(token, secret);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 403 },
    );
  }

  if (payload.projectId !== projectId) {
    return NextResponse.json(
      { error: "Token does not match project" },
      { status: 403 },
    );
  }

  const packVersion = await db.packVersion.findFirst({
    where: { projectId, version: payload.packVersion },
  });

  if (!packVersion) {
    return NextResponse.json(
      { error: "Pack version not found" },
      { status: 404 },
    );
  }

  const files = packVersion.files as Record<string, string>;
  if (!files || Object.keys(files).length === 0) {
    return NextResponse.json(
      { error: "Pack files not yet generated" },
      { status: 404 },
    );
  }

  // Build zip in memory
  const chunks: Buffer[] = [];
  const passThrough = new PassThrough();

  passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(passThrough);

  for (const [filename, content] of Object.entries(files)) {
    archive.append(content, { name: filename });
  }

  await archive.finalize();

  // Wait for stream to finish
  await new Promise<void>((resolve) => passThrough.on("end", resolve));

  const zipBuffer = Buffer.concat(chunks);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="capable-pack-v${packVersion.version}.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
