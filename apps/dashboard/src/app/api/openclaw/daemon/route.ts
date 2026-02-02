import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import {
  startDaemon,
  stopDaemon,
  restartDaemon,
  getDaemonStatus,
} from "@/lib/openclaw";

export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getDaemonStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body as { action: string };

  if (!action || !["start", "stop", "restart"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'start', 'stop', or 'restart'" },
      { status: 400 },
    );
  }

  try {
    switch (action) {
      case "start":
        await startDaemon();
        break;
      case "stop":
        await stopDaemon();
        break;
      case "restart":
        await restartDaemon();
        break;
    }

    // Wait a moment for the daemon to change state
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const status = await getDaemonStatus();

    return NextResponse.json({
      success: true,
      action,
      running: status.running,
      pid: status.pid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
