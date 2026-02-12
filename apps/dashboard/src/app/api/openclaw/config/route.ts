import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import {
  readConfig,
  writeConfig,
  restartDaemon,
  type OpenClawConfig,
} from "@/lib/openclaw";
import { detectProviderFromEnv, getProvider } from "@/lib/providers";

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

  // Detect current provider by scanning env keys
  const env = (config.env as Record<string, string>) ?? {};
  const detectedProvider = detectProviderFromEnv(env);

  // Mask the API key for display
  let maskedKey = "";
  if (config.apiKey) {
    maskedKey = `${config.apiKey.slice(0, 8)}...${config.apiKey.slice(-4)}`;
  } else if (detectedProvider) {
    const rawKey =
      env[detectedProvider.envKey] ||
      (detectedProvider.setupTokenEnvKey
        ? env[detectedProvider.setupTokenEnvKey]
        : "");
    if (rawKey) {
      maskedKey = `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}`;
    }
  }

  // Extract current model from agents.defaults.model.primary
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelConfig = defaults?.model as Record<string, unknown> | undefined;
  const currentModel =
    config.model || (modelConfig?.primary as string) || "";
  // Strip "provider/" prefix if present (e.g. "anthropic/claude-sonnet-4-5" → "claude-sonnet-4-5")
  const modelId = currentModel.includes("/")
    ? currentModel.split("/").slice(1).join("/")
    : currentModel;

  const safeConfig = {
    ...config,
    provider: detectedProvider?.id || config.provider || "",
    apiKey: maskedKey,
    model: modelId,
  };

  return NextResponse.json(safeConfig);
}

export async function PUT(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, apiKey, model, channels } = body as {
    provider?: string;
    apiKey?: string;
    model?: string;
    channels?: Record<string, unknown>;
  };

  // Use registry-aware config writing
  const config = await readConfig();
  const existing = config || ({} as Partial<OpenClawConfig>);
  let hasChanges = false;

  // Update provider + API key
  if (provider && apiKey) {
    const providerDef = getProvider(provider);
    if (providerDef) {
      const env = (existing.env as Record<string, string>) ?? {};
      env[providerDef.envKey] = apiKey;
      existing.env = env;

      // For custom providers, also write models.providers
      if (providerDef.configType === "custom" && providerDef.customProvider) {
        const models =
          ((existing as Record<string, unknown>).models as Record<
            string,
            unknown
          >) ?? {};
        models.mode = "merge";
        const providers =
          (models.providers as Record<string, unknown>) ?? {};
        providers[provider] = {
          baseUrl: providerDef.customProvider.baseUrl,
          apiKey: `$env:${providerDef.envKey}`,
          api: providerDef.customProvider.api,
          models: providerDef.models.map((m) => m.id),
        };
        models.providers = providers;
        (existing as Record<string, unknown>).models = models;
      }

      hasChanges = true;
    }
  } else if (apiKey) {
    // Update API key for current provider
    const env = (existing.env as Record<string, string>) ?? {};
    const currentProvider = detectProviderFromEnv(env);
    if (currentProvider) {
      env[currentProvider.envKey] = apiKey;
      existing.env = env;
      hasChanges = true;
    }
  }

  // Update model
  if (model) {
    const modelProvider = provider || (existing as Record<string, unknown>).provider as string || "";
    const agents = (existing.agents as Record<string, unknown>) ?? {};
    const defaults = (agents.defaults as Record<string, unknown>) ?? {};
    defaults.model = { primary: modelProvider ? `${modelProvider}/${model}` : model };
    agents.defaults = defaults;
    existing.agents = agents as OpenClawConfig["agents"];
    hasChanges = true;
  }

  // Update channels
  if (channels) {
    const existingChannels =
      (existing.channels as Record<string, unknown>) ?? {};
    existing.channels = { ...existingChannels, ...channels };
    hasChanges = true;
  }

  if (!hasChanges) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    );
  }

  try {
    await writeConfig(existing as Partial<OpenClawConfig>);
    await restartDaemon();
    return NextResponse.json({ success: true, restarted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
