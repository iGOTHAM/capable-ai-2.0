import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySignedToken } from "@capable-ai/shared";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const format = request.nextUrl.searchParams.get("format");

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

  // JSON format: return files directly as JSON (fast, no zip overhead)
  // Used by cloud-init scripts — avoids archiver cold-start timeout on serverless
  if (format === "json") {
    return NextResponse.json({ files, version: packVersion.version });
  }

  // ZIP format: build zip using built-in zlib (no archiver dependency)
  const { createDeflateRaw } = await import("zlib");
  const { promisify } = await import("util");

  // Simple ZIP builder using raw deflate
  const entries: { name: Buffer; compressed: Buffer; crc: number; size: number }[] = [];

  for (const [filename, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(filename, "utf-8");
    const data = Buffer.from(content, "utf-8");
    const crc = crc32(data);

    // Compress with deflateRaw
    const deflate = promisify(
      (buf: Buffer, cb: (err: Error | null, result: Buffer) => void) => {
        const chunks: Buffer[] = [];
        const stream = createDeflateRaw({ level: 1 }); // fast compression
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => cb(null, Buffer.concat(chunks)));
        stream.on("error", cb);
        stream.end(buf);
      },
    );

    const compressed = await deflate(data);
    entries.push({ name: nameBytes, compressed, crc, size: data.length });
  }

  // Build the ZIP file
  const parts: Buffer[] = [];
  const centralDir: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    // Local file header
    const localHeader = Buffer.alloc(30 + entry.name.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression method (deflate)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(entry.crc, 14); // crc-32
    localHeader.writeUInt32LE(entry.compressed.length, 18); // compressed size
    localHeader.writeUInt32LE(entry.size, 22); // uncompressed size
    localHeader.writeUInt16LE(entry.name.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra field length
    entry.name.copy(localHeader, 30);

    // Central directory entry
    const cdEntry = Buffer.alloc(46 + entry.name.length);
    cdEntry.writeUInt32LE(0x02014b50, 0); // central dir header signature
    cdEntry.writeUInt16LE(20, 4); // version made by
    cdEntry.writeUInt16LE(20, 6); // version needed
    cdEntry.writeUInt16LE(0, 8); // flags
    cdEntry.writeUInt16LE(8, 10); // compression method
    cdEntry.writeUInt16LE(0, 12); // mod time
    cdEntry.writeUInt16LE(0, 14); // mod date
    cdEntry.writeUInt32LE(entry.crc, 16); // crc-32
    cdEntry.writeUInt32LE(entry.compressed.length, 20); // compressed size
    cdEntry.writeUInt32LE(entry.size, 24); // uncompressed size
    cdEntry.writeUInt16LE(entry.name.length, 28); // filename length
    cdEntry.writeUInt16LE(0, 30); // extra field length
    cdEntry.writeUInt16LE(0, 32); // file comment length
    cdEntry.writeUInt16LE(0, 34); // disk number start
    cdEntry.writeUInt16LE(0, 36); // internal file attributes
    cdEntry.writeUInt32LE(0, 38); // external file attributes
    cdEntry.writeUInt32LE(offset, 42); // relative offset of local header
    entry.name.copy(cdEntry, 46);

    parts.push(localHeader, entry.compressed);
    centralDir.push(cdEntry);
    offset += localHeader.length + entry.compressed.length;
  }

  const cdOffset = offset;
  const cdSize = centralDir.reduce((sum, buf) => sum + buf.length, 0);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where central dir starts
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(cdSize, 12); // size of central directory
  eocd.writeUInt32LE(cdOffset, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  const zipBuffer = Buffer.concat([...parts, ...centralDir, eocd]);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="capable-pack-v${packVersion.version}.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}

// CRC-32 implementation (standard polynomial)
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
