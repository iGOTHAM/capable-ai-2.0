import { NextRequest, NextResponse } from "next/server";

// Simple cloud-init progress logger — stores last 50 entries in memory
// Used for debugging cloud-init failures on droplets
const logs: { ts: string; projectToken: string; step: string; status: string; error?: string }[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectToken, step, status, error } = body;

    if (!projectToken || !step) {
      return NextResponse.json({ error: "Missing projectToken or step" }, { status: 400 });
    }

    const entry = {
      ts: new Date().toISOString(),
      projectToken: String(projectToken).slice(0, 8) + "...",
      step: String(step),
      status: String(status || "ok"),
      ...(error ? { error: String(error).slice(0, 500) } : {}),
    };

    logs.push(entry);
    if (logs.length > 50) logs.shift();

    console.log(`[cloud-init] ${entry.step} → ${entry.status}${entry.error ? ` (${entry.error})` : ""}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ logs });
}
