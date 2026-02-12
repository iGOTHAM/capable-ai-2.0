import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { validateApiKey, type Provider } from "@/lib/openclaw";

export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, apiKey } = body as { provider: string; apiKey: string };

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: "Missing provider or apiKey" },
      { status: 400 },
    );
  }

  if (provider !== "anthropic" && provider !== "openai") {
    return NextResponse.json(
      { error: "Invalid provider. Must be 'anthropic' or 'openai'" },
      { status: 400 },
    );
  }

  const result = await validateApiKey(provider as Provider, apiKey);
  return NextResponse.json(result);
}
