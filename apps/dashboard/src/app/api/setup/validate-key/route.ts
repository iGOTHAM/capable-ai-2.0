import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { validateApiKey } from "@/lib/openclaw";
import { getProvider } from "@/lib/providers";

export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, apiKey, authMethod } = body as {
    provider: string;
    apiKey: string;
    authMethod?: string;
  };

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: "Missing provider or apiKey" },
      { status: 400 },
    );
  }

  if (!getProvider(provider)) {
    return NextResponse.json(
      { error: `Unknown provider: ${provider}` },
      { status: 400 },
    );
  }

  const result = await validateApiKey(provider, apiKey, authMethod ?? "api-key");
  return NextResponse.json(result);
}
