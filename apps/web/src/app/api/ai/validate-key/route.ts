import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const validateKeySchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  apiKey: z.string().min(1, "API key is required"),
});

/**
 * POST /api/ai/validate-key
 *
 * Proxy route to validate an LLM API key against the provider.
 * The key is NOT stored or logged — only passed through to validate.
 *
 * Body: { provider: "anthropic" | "openai", apiKey: string }
 * Response: { valid: true } or { valid: false, error: string }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validateKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { provider, apiKey } = parsed.data;

  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-20250414",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        return NextResponse.json({ valid: true });
      }

      const data = await res.json().catch(() => ({}));
      const errorMsg =
        data?.error?.message || `Anthropic returned ${res.status}`;

      // 401 = invalid key, 403 = key doesn't have access
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ valid: false, error: "Invalid API key" });
      }

      return NextResponse.json({ valid: false, error: errorMsg });
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        return NextResponse.json({ valid: true });
      }

      if (res.status === 401) {
        return NextResponse.json({ valid: false, error: "Invalid API key" });
      }

      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        valid: false,
        error: data?.error?.message || `OpenAI returned ${res.status}`,
      });
    }

    return NextResponse.json({ valid: false, error: "Unknown provider" });
  } catch (err) {
    return NextResponse.json({
      valid: false,
      error:
        err instanceof Error ? err.message : "Failed to validate API key",
    });
  }
}
