import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline
 * Returns the full pipeline data: stages + projects.
 * Seeds from demo data on first access if pipeline.json doesn't exist.
 */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await readPipeline();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read pipeline";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
