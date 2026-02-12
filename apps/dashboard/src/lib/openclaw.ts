import { readFile, writeFile, unlink, access, chmod } from "fs/promises";
import path from "path";
import { getProvider, detectProviderFromEnv, getAllEnvKeys } from "./providers";

// Paths — configurable via env vars (set in systemd service by cloud-init)
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const OPENCLAW_CONFIG = process.env.OPENCLAW_CONFIG || path.join(OPENCLAW_DIR, "openclaw.json");
const SETUP_MARKER = path.join(OPENCLAW_DIR, ".setup-pending");
const AGENT_IDENTITY_FILE = path.join(OPENCLAW_DIR, "agent-identity.json");

// ─── Types ──────────────────────────────────────────────────────────────────

export type SetupState = "pending" | "configured" | "running" | "error";

export type Provider = string;

export interface OpenClawConfig {
  workspace: string;
  // Legacy fields (old schema — may be deleted by set-key endpoint)
  provider: string;
  apiKey: string;
  model: string;
  // New OpenClaw schema fields
  env: Record<string, string>;
  agents: {
    defaults: {
      model: { primary: string };
    };
  };
  gateway: Record<string, unknown>;
  compaction: {
    memoryFlush: {
      enabled: boolean;
    };
  };
  memorySearch: {
    experimental: {
      sessionMemory: boolean;
    };
    sources: string[];
  };
  skills: {
    enabled: string[];
    disabled: string[];
  };
  security: {
    execPolicy: string;
    sandboxMode: string;
    allowExternalUrls: boolean;
    dmPairingRequired: boolean;
  };
  channels: Record<string, unknown>;
}

export interface SetupLaunchParams {
  provider: Provider;
  authMethod: string;
  apiKey: string;
  model: string;
  telegramToken?: string;
}

export interface DaemonStatus {
  running: boolean;
  pid?: number;
}

// ─── File Helpers ───────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Config Operations ──────────────────────────────────────────────────────

export async function readConfig(): Promise<OpenClawConfig | null> {
  try {
    const raw = await readFile(OPENCLAW_CONFIG, "utf-8");
    return JSON.parse(raw) as OpenClawConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(
  patch: Partial<OpenClawConfig>,
): Promise<void> {
  const existing = (await readConfig()) || ({} as Partial<OpenClawConfig>);
  const merged = { ...existing, ...patch };

  // Deep merge channels if provided
  if (patch.channels && existing.channels) {
    merged.channels = { ...existing.channels, ...patch.channels };
  }

  await writeFile(OPENCLAW_CONFIG, JSON.stringify(merged, null, 2), "utf-8");
  await chmod(OPENCLAW_CONFIG, 0o600);
}

// ─── Setup State ────────────────────────────────────────────────────────────

export async function getSetupState(): Promise<SetupState> {
  const markerExists = await fileExists(SETUP_MARKER);
  if (markerExists) return "pending";

  const config = await readConfig();
  if (!config) return "pending";

  // Check all known provider env keys (not just anthropic/openai)
  const env = (config.env as Record<string, string>) ?? {};
  const hasApiKey =
    (config.provider && config.apiKey) || detectProviderFromEnv(env);

  if (!hasApiKey) return "pending";

  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelConfig = defaults?.model as Record<string, unknown> | undefined;
  const hasModel = config.model || modelConfig?.primary;

  if (hasModel) return "running";

  return "configured";
}

export async function removeSetupMarker(): Promise<void> {
  try {
    await unlink(SETUP_MARKER);
  } catch {
    // Already removed or never existed
  }
}

// ─── Agent Status ────────────────────────────────────────────────────────────
// Checks whether the OpenClaw gateway is actually running by probing port 18789.
// Falls back to config-based check if the network probe can't be performed.

const GATEWAY_HOST = process.env.OPENCLAW_GATEWAY_HOST || "127.0.0.1";
const GATEWAY_PORT = parseInt(process.env.OPENCLAW_GATEWAY_PORT || "18789", 10);

export async function getDaemonStatus(): Promise<DaemonStatus> {
  // 1. Try a real health check — probe the gateway over HTTP
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`http://${GATEWAY_HOST}:${GATEWAY_PORT}/`, {
      method: "GET",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    // Any response (even 4xx/5xx) means the process is alive
    if (res) {
      return { running: true, pid: undefined };
    }
  } catch {
    // fetch failed — gateway is not listening, fall through to config check
  }

  // 2. Fallback: check if config has API key + model (legacy heuristic)
  const config = await readConfig();
  if (!config) return { running: false };

  const env = (config.env as Record<string, string>) ?? {};
  const hasApiKey =
    (config.provider && config.apiKey) || detectProviderFromEnv(env);

  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelConfig = defaults?.model as Record<string, unknown> | undefined;
  const hasModel = config.model || modelConfig?.primary;

  if (hasApiKey && hasModel) {
    return { running: true, pid: process.pid };
  }
  return { running: false };
}

export async function startDaemon(): Promise<void> {
  // No-op: the dashboard IS the agent runtime.
  // Config is written by the setup wizard; chat API calls the LLM directly.
}

export async function stopDaemon(): Promise<void> {
  // No-op: stopping the "agent" would mean stopping the dashboard itself.
}

export async function restartDaemon(): Promise<void> {
  // No-op: the dashboard handles chat directly, no separate daemon to restart.
}

// ─── API Key Validation ─────────────────────────────────────────────────────

export async function validateApiKey(
  provider: Provider,
  apiKey: string,
  authMethod: string = "api-key",
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Setup tokens are not validated against the API — they're used at runtime
    if (authMethod === "setup-token") {
      if (!apiKey.trim()) {
        return { valid: false, error: "Please enter your setup token" };
      }
      return { valid: true };
    }

    const providerDef = getProvider(provider);
    if (!providerDef) {
      return { valid: false, error: `Unknown provider: ${provider}` };
    }

    // Anthropic has its own API format (not OpenAI-compatible)
    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-20250414",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });

      if (response.ok) return { valid: true };

      const data = (await response.json()) as {
        error?: { message?: string };
      };
      if (response.status === 401) {
        return { valid: false, error: "Invalid API key" };
      }
      return {
        valid: false,
        error: data.error?.message || "Failed to validate key",
      };
    }

    // Google Gemini has its own API format
    if (provider === "google-gemini") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      );
      if (response.ok) return { valid: true };
      if (response.status === 400 || response.status === 401) {
        return { valid: false, error: "Invalid API key" };
      }
      return { valid: false, error: "Failed to validate key" };
    }

    // OpenAI-compatible providers: GET /models with Bearer token
    const baseUrl =
      providerDef.validationBaseUrl ||
      providerDef.customProvider?.baseUrl;

    if (baseUrl) {
      const modelsUrl = baseUrl.endsWith("/v1")
        ? `${baseUrl}/models`
        : `${baseUrl}/models`;
      const response = await fetch(modelsUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) return { valid: true };
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: "Invalid API key" };
      }
      return { valid: false, error: "Failed to validate key" };
    }

    // No validation endpoint known — accept and let OpenClaw validate at runtime
    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return { valid: false, error: message };
  }
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export async function getEnabledSkills(): Promise<string[]> {
  const config = await readConfig();
  return config?.skills?.enabled || [];
}

export async function setEnabledSkills(
  enabled: string[],
  disabled: string[],
): Promise<void> {
  await writeConfig({ skills: { enabled, disabled } } as Partial<OpenClawConfig>);
}

// ─── Full Setup Launch ──────────────────────────────────────────────────────

export async function launchSetup(
  params: SetupLaunchParams,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Read existing config and update using OpenClaw's documented schema:
    //    - env.ANTHROPIC_API_KEY or env.OPENAI_API_KEY for API keys
    //    - agents.defaults.model.primary for model selection
    //    This matches the format used by the admin set-key endpoint.
    const existing = (await readConfig()) || ({} as Partial<OpenClawConfig>);

    // Remove legacy top-level fields
    delete existing.provider;
    delete existing.apiKey;
    delete existing.model;

    // Look up provider from registry
    const providerDef = getProvider(params.provider);
    if (!providerDef) {
      return { success: false, error: `Unknown provider: ${params.provider}` };
    }

    // Set env with provider API key (or setup token)
    const env = (existing.env as Record<string, string>) ?? {};
    if (params.authMethod === "setup-token" && providerDef.setupTokenEnvKey) {
      env[providerDef.setupTokenEnvKey] = params.apiKey;
      // Remove the regular API key if it exists (user switched from API key to token)
      delete env[providerDef.envKey];
    } else {
      env[providerDef.envKey] = params.apiKey;
      // Remove setup token if it exists (user switched from token to API key)
      if (providerDef.setupTokenEnvKey) {
        delete env[providerDef.setupTokenEnvKey];
      }
    }
    existing.env = env;

    // For custom providers, write models.providers block
    if (providerDef.configType === "custom" && providerDef.customProvider) {
      const models = (existing as Record<string, unknown>).models as Record<string, unknown> ?? {};
      models.mode = "merge";
      const providers = (models.providers as Record<string, unknown>) ?? {};
      providers[params.provider] = {
        baseUrl: providerDef.customProvider.baseUrl,
        apiKey: `$env:${providerDef.envKey}`,
        api: providerDef.customProvider.api,
        models: providerDef.models.map((m) => m.id),
      };
      models.providers = providers;
      (existing as Record<string, unknown>).models = models;
    }

    // Set agents.defaults.model.primary as "provider/model"
    const agents = (existing.agents as Record<string, unknown>) ?? {};
    const defaults = (agents.defaults as Record<string, unknown>) ?? {};
    defaults.model = { primary: `${params.provider}/${params.model}` };
    // For custom providers, add selected model to allowlist
    if (providerDef.configType === "custom") {
      const existingModels = (defaults.models as string[]) ?? [];
      if (!existingModels.includes(params.model)) {
        defaults.models = [params.model, ...existingModels];
      }
    }
    agents.defaults = defaults;
    existing.agents = agents as OpenClawConfig["agents"];

    // Ensure gateway settings are configured
    const gateway = (existing.gateway as Record<string, unknown>) ?? {};
    if (!gateway.mode) {
      gateway.mode = "local";
    }
    if (!gateway.auth) {
      const { randomBytes } = await import("crypto");
      gateway.auth = {
        mode: "token",
        token: randomBytes(32).toString("hex"),
      };
    }
    if (!gateway.controlUi) {
      gateway.controlUi = {
        basePath: "/chat",
        allowInsecureAuth: true,
      };
    }
    // Trust Caddy reverse proxy headers (both IPv4 and IPv6 loopback)
    if (!gateway.trustedProxies) {
      gateway.trustedProxies = ["127.0.0.1", "::1"];
    }
    existing.gateway = gateway;

    // 2. Add Telegram channel if provided
    if (params.telegramToken) {
      const channels = (existing.channels as Record<string, unknown>) ?? {};
      channels.telegram = {
        enabled: true,
        botToken: params.telegramToken,
      };
      existing.channels = channels;
    }

    // Write the full config (not a shallow merge — we already merged above)
    await writeFile(OPENCLAW_CONFIG, JSON.stringify(existing, null, 2), "utf-8");
    await chmod(OPENCLAW_CONFIG, 0o600);

    // 3. Remove setup marker
    await removeSetupMarker();

    // 4. Restart OpenClaw service so it picks up the new config
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execPromise = promisify(exec);

      if (process.env.CONTAINER_MODE === "docker") {
        // Docker mode: restart sibling container via Docker socket
        await execPromise("docker restart capable-openclaw");
        await new Promise(r => setTimeout(r, 5000));
      } else {
        // Bare-metal mode: restart systemd services
        const serviceNames = ["capable-openclaw", "openclaw-gateway"];
        for (const svcName of serviceNames) {
          try {
            await execPromise(`systemctl restart ${svcName} 2>/dev/null || systemctl --user restart ${svcName} 2>/dev/null`);
          } catch {
            // Service might not exist under this name, that's fine
          }
        }
      }
    } catch {
      // Best-effort restart — gateway may need manual restart
    }

    // 5. Verify the config is readable
    const config = await readConfig();
    const verifyEnv = (config?.env as Record<string, string>) ?? {};
    const detectedProvider = detectProviderFromEnv(verifyEnv);
    if (detectedProvider) {
      return { success: true };
    }

    return {
      success: false,
      error: "Configuration was not saved correctly. Please try again.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Launch failed";
    return { success: false, error: message };
  }
}

// ─── Agent Identity (separate file — NOT in openclaw.json) ─────────────────

export interface AgentIdentity {
  name: string;
  emoji: string;
  tagline: string;
}

const DEFAULT_IDENTITY: AgentIdentity = {
  name: "Atlas",
  emoji: "🤖",
  tagline: "Your AI Assistant",
};

/**
 * Read agent identity from agent-identity.json.
 * Falls back to defaults if the file doesn't exist, and also migrates
 * any legacy identity fields from openclaw.json on first read.
 */
export async function readAgentIdentity(): Promise<AgentIdentity> {
  try {
    const raw = await readFile(AGENT_IDENTITY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AgentIdentity>;
    return {
      name: parsed.name || DEFAULT_IDENTITY.name,
      emoji: parsed.emoji || DEFAULT_IDENTITY.emoji,
      tagline: parsed.tagline ?? DEFAULT_IDENTITY.tagline,
    };
  } catch {
    // File doesn't exist — try to migrate from openclaw.json
    try {
      const config = await readConfig();
      const agents = config?.agents as Record<string, unknown> | undefined;
      const defaults = agents?.defaults as Record<string, unknown> | undefined;
      if (defaults?.name || defaults?.emoji || defaults?.tagline) {
        const migrated: AgentIdentity = {
          name: (defaults?.name as string) || DEFAULT_IDENTITY.name,
          emoji: (defaults?.emoji as string) || DEFAULT_IDENTITY.emoji,
          tagline: (defaults?.tagline as string) ?? DEFAULT_IDENTITY.tagline,
        };
        // Write to separate file
        await writeAgentIdentity(migrated);
        // Clean up legacy keys from openclaw.json
        delete defaults.name;
        delete defaults.emoji;
        delete defaults.tagline;
        const existing = config as unknown as Record<string, unknown>;
        existing.agents = { ...agents, defaults };
        await writeFile(OPENCLAW_CONFIG, JSON.stringify(existing, null, 2), "utf-8");
        await chmod(OPENCLAW_CONFIG, 0o600);
        return migrated;
      }
    } catch {
      // Ignore migration errors
    }
    return { ...DEFAULT_IDENTITY };
  }
}

/**
 * Write agent identity to agent-identity.json (never touches openclaw.json).
 */
export async function writeAgentIdentity(identity: Partial<AgentIdentity>): Promise<void> {
  const current = await readAgentIdentity();
  const merged: AgentIdentity = {
    name: identity.name ?? current.name,
    emoji: identity.emoji ?? current.emoji,
    tagline: identity.tagline ?? current.tagline,
  };
  await writeFile(AGENT_IDENTITY_FILE, JSON.stringify(merged, null, 2), "utf-8");
  await chmod(AGENT_IDENTITY_FILE, 0o600);
}
