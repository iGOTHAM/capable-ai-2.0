import { readFile, writeFile, unlink, access, chmod } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

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

  const daemon = await getDaemonStatus();
  if (daemon.running) return "running";

  return "configured";
}

export async function removeSetupMarker(): Promise<void> {
  try {
    await unlink(SETUP_MARKER);
  } catch {
    // Already removed or never existed
  }
}

// ─── Daemon Management ──────────────────────────────────────────────────────

export async function getDaemonStatus(): Promise<DaemonStatus> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-f", "openclaw"]);
    const firstLine = stdout.trim().split("\n")[0] ?? "";
    const pid = parseInt(firstLine, 10);
    return { running: !isNaN(pid), pid: isNaN(pid) ? undefined : pid };
  } catch {
    return { running: false };
  }
}

export async function startDaemon(): Promise<void> {
  // Start OpenClaw as a background daemon using systemd
  // First check if the systemd service file exists, if not create it
  const serviceExists = await fileExists(
    "/etc/systemd/system/capable-openclaw.service",
  );

  if (!serviceExists) {
    const serviceContent = `[Unit]
Description=OpenClaw AI Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/npx openclaw start
Restart=always
RestartSec=10
Environment=HOME=/root
WorkingDirectory=/root

[Install]
WantedBy=multi-user.target
`;
    await writeFile(
      "/etc/systemd/system/capable-openclaw.service",
      serviceContent,
      "utf-8",
    );
    await execFileAsync("systemctl", ["daemon-reload"]);
  }

  await execFileAsync("systemctl", ["enable", "capable-openclaw"]);
  await execFileAsync("systemctl", ["start", "capable-openclaw"]);
}

export async function stopDaemon(): Promise<void> {
  try {
    await execFileAsync("systemctl", ["stop", "capable-openclaw"]);
  } catch {
    // May not be running
  }
}

export async function restartDaemon(): Promise<void> {
  try {
    await execFileAsync("systemctl", ["restart", "capable-openclaw"]);
  } catch {
    // If restart fails, try stop then start
    await stopDaemon();
    await startDaemon();
  }
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

    // 4. Start the daemon
    await startDaemon();

    // 5. Wait up to 15 seconds for daemon to start
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const status = await getDaemonStatus();
      if (status.running) {
        return { success: true };
      }
    }

    // Daemon didn't start within timeout — check if it's running one more time
    const finalStatus = await getDaemonStatus();
    if (finalStatus.running) {
      return { success: true };
    }

    return {
      success: false,
      error: "OpenClaw daemon did not start within 15 seconds. Check logs with: journalctl -u capable-openclaw -n 50",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Launch failed";
    return { success: false, error: message };
  }
}
