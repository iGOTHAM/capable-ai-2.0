import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/files/extract-text
 *
 * Accepts a multipart file upload (PDF, DOCX, XLSX) and returns extracted text.
 * Auth-gated — requires active session.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  let content: string;

  try {
    switch (ext) {
      case "pdf": {
        // Import from lib/pdf-parse directly to avoid pdf-parse's index.js
        // which tries to read a test file on import (known v1 bug)
        const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await pdfParse(buffer);
        content = result.text;
        break;
      }
      case "docx": {
        const mammoth = await import("mammoth");
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
        break;
      }
      case "xlsx": {
        const XLSX = await import("xlsx");
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const lines: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          lines.push(`## ${sheetName}`);
          const csv = XLSX.utils.sheet_to_csv(sheet);
          lines.push(csv);
          lines.push("");
        }
        content = lines.join("\n");
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unsupported file type: .${ext}` },
          { status: 400 },
        );
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Text extraction failed:", errMsg, err);
    return NextResponse.json(
      { error: `Failed to extract text: ${errMsg}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    filename: file.name,
    content,
  });
}
