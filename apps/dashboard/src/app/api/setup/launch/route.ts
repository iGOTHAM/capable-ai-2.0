import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { launchSetup } from "@/lib/openclaw";
import { getProvider } from "@/lib/providers";

export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, apiKey, model, authMethod, telegramToken } = body as {
    provider: string;
    apiKey: string;
    model: string;
    authMethod?: string;
    telegramToken?: string;
  };

  if (!provider || !apiKey || !model) {
    return NextResponse.json(
      { error: "Missing required fields: provider, apiKey, model" },
      { status: 400 },
    );
  }

  if (!getProvider(provider)) {
    return NextResponse.json(
      { error: `Unknown provider: ${provider}` },
      { status: 400 },
    );
  }

  const result = await launchSetup({
    provider,
    authMethod: authMethod ?? "api-key",
    apiKey,
    model,
    telegramToken: telegramToken || undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Launch failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, status: "running" });
}
