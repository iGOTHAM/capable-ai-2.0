import { readFile, writeFile, unlink, access, chmod } from "fs/promises";
import path from "path";

// Paths — configurable via env vars (set in systemd service by cloud-init)
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const OPENCLAW_CONFIG = process.env.OPENCLAW_CONFIG || path.join(OPENCLAW_DIR, "openclaw.json");
const SETUP_MARKER = path.join(OPENCLAW_DIR, ".setup-pending");

// ─── Types ──────────────────────────────────────────────────────────────────

export type SetupState = "pending" | "configured" | "running" | "error";

export type Provider = "anthropic" | "openai";

export interface OpenClawConfig {
  workspace: string;
  provider: string;
  apiKey: string;
  model: string;
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
  if (!config || !config.provider || !config.apiKey) return "pending";

  // The dashboard itself IS the agent runtime — if config has
  // provider + apiKey + model, the agent is ready to handle chat.
  if (config.model) return "running";

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
// The dashboard itself serves as the agent runtime. Chat requests go through
// the dashboard API which calls the configured LLM provider directly.
// "Running" means: config exists with provider + apiKey + model.

export async function getDaemonStatus(): Promise<DaemonStatus> {
  const config = await readConfig();
  if (config?.provider && config?.apiKey && config?.model) {
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
): Promise<{ valid: boolean; error?: string }> {
  try {
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

    if (provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (response.ok) return { valid: true };
      if (response.status === 401) {
        return { valid: false, error: "Invalid API key" };
      }
      return { valid: false, error: "Failed to validate key" };
    }

    return { valid: false, error: `Unknown provider: ${provider}` };
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
    // 1. Write provider, API key, and model to config
    const configPatch: Partial<OpenClawConfig> = {
      provider: params.provider,
      apiKey: params.apiKey,
      model: params.model,
    };

    // 2. Add Telegram channel if provided
    if (params.telegramToken) {
      configPatch.channels = {
        telegram: {
          enabled: true,
          botToken: params.telegramToken,
        },
      };
    }

    await writeConfig(configPatch);

    // 3. Remove setup marker
    await removeSetupMarker();

    // 4. The dashboard IS the agent runtime — no separate daemon to start.
    // Once config is written, the chat API will use it to call the LLM.
    // Verify the config is readable.
    const config = await readConfig();
    if (config?.provider && config?.apiKey && config?.model) {
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
