import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { launchSetup, type Provider } from "@/lib/openclaw";

export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, apiKey, model, telegramToken } = body as {
    provider: string;
    apiKey: string;
    model: string;
    telegramToken?: string;
  };

  if (!provider || !apiKey || !model) {
    return NextResponse.json(
      { error: "Missing required fields: provider, apiKey, model" },
      { status: 400 },
    );
  }

  if (provider !== "anthropic" && provider !== "openai") {
    return NextResponse.json(
      { error: "Invalid provider" },
      { status: 400 },
    );
  }

  const result = await launchSetup({
    provider: provider as Provider,
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
