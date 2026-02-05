/**
 * ChannelManager — manages external channel adapters (Telegram, etc).
 *
 * Reads config and starts/stops adapters based on enabled channels.
 * Initialized via Next.js instrumentation hook on server startup.
 */

import { readConfig } from "@/lib/openclaw";
import { TelegramAdapter } from "./telegram";

export class ChannelManager {
  private telegram: TelegramAdapter | null = null;
  private initialized = false;

  /** Initialize channels from config. Safe to call multiple times. */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const config = await readConfig();
      if (!config) {
        console.log("[ChannelManager] No config found, skipping channel init");
        return;
      }

      // Check for Telegram config
      const tgConfig = config.channels?.telegram as
        | { enabled?: boolean; botToken?: string }
        | undefined;

      if (tgConfig?.enabled && tgConfig?.botToken) {
        console.log("[ChannelManager] Starting Telegram adapter...");
        this.telegram = new TelegramAdapter(tgConfig.botToken);
        this.telegram.start();
      }
    } catch (err) {
      console.error("[ChannelManager] Init error:", err);
    }
  }

  /** Stop all channels */
  stop(): void {
    this.telegram?.stop();
    this.telegram = null;
    this.initialized = false;
  }

  /** Restart channels (e.g., after config change) */
  async restart(): Promise<void> {
    this.stop();
    await this.init();
  }

  /** Get status of all channels */
  getStatus(): Record<string, { running: boolean }> {
    return {
      telegram: { running: this.telegram?.isRunning() ?? false },
    };
  }
}

// Singleton instance
export const channelManager = new ChannelManager();
