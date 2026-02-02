import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import {
  readConfig,
  writeConfig,
  restartDaemon,
  type OpenClawConfig,
} from "@/lib/openclaw";

export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await readConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Config not found" },
      { status: 404 },
    );
  }

  // Return config without the API key (mask it)
  const safeConfig = {
    ...config,
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}...${config.apiKey.slice(-4)}` : "",
  };

  return NextResponse.json(safeConfig);
}

export async function PUT(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, apiKey, model, channels } = body as Partial<OpenClawConfig>;

  const patch: Partial<OpenClawConfig> = {};
  if (provider) patch.provider = provider;
  if (apiKey) patch.apiKey = apiKey;
  if (model) patch.model = model;
  if (channels) patch.channels = channels;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    );
  }

  try {
    await writeConfig(patch);
    await restartDaemon();
    return NextResponse.json({ success: true, restarted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
