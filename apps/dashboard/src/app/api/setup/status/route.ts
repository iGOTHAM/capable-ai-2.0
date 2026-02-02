import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getSetupState, getDaemonStatus, readConfig } from "@/lib/openclaw";

export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const setupState = await getSetupState();
  const daemon = await getDaemonStatus();
  const config = await readConfig();

  const channels: string[] = [];
  if (config?.channels) {
    for (const [name, value] of Object.entries(config.channels)) {
      if (
        value &&
        typeof value === "object" &&
        "enabled" in value &&
        value.enabled
      ) {
        channels.push(name);
      }
    }
  }

  return NextResponse.json({
    setupState,
    daemonRunning: daemon.running,
    daemonPid: daemon.pid,
    provider: config?.provider || null,
    model: config?.model || null,
    channels,
  });
}
