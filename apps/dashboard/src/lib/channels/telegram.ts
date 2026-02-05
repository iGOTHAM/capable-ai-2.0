/**
 * Telegram adapter — long-polling bot for Capable.ai dashboards.
 *
 * Uses Telegram Bot API directly (no libraries).
 * DM pairing: first user to message the bot is "paired" — all others are rejected.
 * Cross-platform: messages appear in dashboard chat history via shared NDJSON events.
 */

import { processMessage } from "@/lib/chat-engine";
import { appendEvent } from "@/lib/events";

const TELEGRAM_API = "https://api.telegram.org/bot";
const POLL_TIMEOUT = 30; // seconds (Telegram long-polling)

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

interface TelegramResponse {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
}

export class TelegramAdapter {
  private token: string;
  private running = false;
  private offset = 0;
  private pairedUserId: number | null = null;
  private abortController: AbortController | null = null;

  constructor(token: string) {
    this.token = token;
  }

  /** Start long-polling loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log("[Telegram] Starting long-polling...");
    this.poll();
  }

  /** Stop polling */
  stop(): void {
    this.running = false;
    this.abortController?.abort();
    console.log("[Telegram] Stopped.");
  }

  isRunning(): boolean {
    return this.running;
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        this.abortController = new AbortController();
        const updates = await this.getUpdates();

        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") continue;
        console.error("[Telegram] Poll error:", err);
        // Wait before retrying on error
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    const url = `${TELEGRAM_API}${this.token}/getUpdates?offset=${this.offset}&timeout=${POLL_TIMEOUT}&allowed_updates=["message"]`;

    const res = await fetch(url, {
      signal: this.abortController?.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Telegram API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as TelegramResponse;
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result || [];
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text || !msg.from) return;

    // DM pairing: first user to message is paired
    if (this.pairedUserId === null) {
      this.pairedUserId = msg.from.id;
      console.log(`[Telegram] Paired with user ${msg.from.first_name} (${msg.from.id})`);
    }

    // Reject messages from non-paired users
    if (msg.from.id !== this.pairedUserId) {
      await this.sendMessage(
        msg.chat.id,
        "This bot is configured for a specific user. Access denied.",
      );
      return;
    }

    const text = msg.text.trim();
    if (!text) return;

    // Log incoming telegram message
    await appendEvent({
      ts: new Date().toISOString(),
      runId: `tg-${Date.now()}`,
      type: "channel.message_received",
      summary: text,
      details: {
        channel: "telegram",
        userId: String(msg.from.id),
        username: msg.from.username || msg.from.first_name,
      },
    });

    // Send typing indicator
    await this.sendChatAction(msg.chat.id, "typing");

    try {
      const result = await processMessage(text);

      // Convert markdown to Telegram-friendly format
      const telegramText = markdownToTelegram(result.response);

      await this.sendMessage(msg.chat.id, telegramText, "MarkdownV2");

      // Log outgoing telegram message
      await appendEvent({
        ts: new Date().toISOString(),
        runId: `tg-${Date.now()}`,
        type: "channel.message_sent",
        summary: result.response.slice(0, 200),
        details: {
          channel: "telegram",
          toolCalls: result.toolCalls.map((tc) => ({ name: tc.name, args: tc.args })),
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to process message";
      console.error("[Telegram] Processing error:", errorMsg);
      await this.sendMessage(msg.chat.id, `Sorry, I encountered an error: ${errorMsg}`);
    }
  }

  private async sendMessage(
    chatId: number,
    text: string,
    parseMode?: string,
  ): Promise<void> {
    // Telegram messages have a 4096 character limit
    const chunks = splitMessage(text, 4096);

    for (const chunk of chunks) {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        text: chunk,
      };
      if (parseMode) body.parse_mode = parseMode;

      try {
        const res = await fetch(`${TELEGRAM_API}${this.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          // Retry without parse_mode if MarkdownV2 fails
          if (parseMode) {
            await fetch(`${TELEGRAM_API}${this.token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: chunk }),
            });
          }
        }
      } catch (err) {
        console.error("[Telegram] Send error:", err);
      }
    }
  }

  private async sendChatAction(chatId: number, action: string): Promise<void> {
    try {
      await fetch(`${TELEGRAM_API}${this.token}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action }),
      });
    } catch {
      // Non-critical, ignore
    }
  }
}

// ─── Telegram formatting helpers ────────────────────────────────────────────

/** Escape special characters for MarkdownV2 */
function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/** Convert standard markdown to Telegram MarkdownV2 */
function markdownToTelegram(text: string): string {
  // This is a simplified converter. For complex markdown,
  // we fall back to plain text (sendMessage retries without parse_mode).
  try {
    let result = text;

    // Bold: **text** → *text*
    result = result.replace(/\*\*(.+?)\*\*/g, (_, content) => `*${escapeMarkdownV2(content)}*`);

    // Italic: *text* (single) → _text_
    // (Skip this to avoid conflicts with bold)

    // Code blocks: ```code``` → ```code```
    result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `\`\`\`${lang}\n${code}\`\`\``);

    // Inline code: `code` → `code`
    // Already valid in MarkdownV2

    // Links: [text](url)
    // Already valid in MarkdownV2, but text needs escaping
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) =>
      `[${escapeMarkdownV2(linkText)}](${url})`,
    );

    // Escape remaining special chars in plain text sections
    // This is tricky — for simplicity, just escape the basics
    result = result.replace(/(?<!\\)([~>#+\-=|{}.!])/g, "\\$1");

    return result;
  } catch {
    // If conversion fails, return escaped plain text
    return escapeMarkdownV2(text);
  }
}

/** Split long messages at paragraph boundaries */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Try to split at paragraph
    let splitIdx = remaining.lastIndexOf("\n\n", maxLen);
    if (splitIdx < maxLen / 2) {
      // Try single newline
      splitIdx = remaining.lastIndexOf("\n", maxLen);
    }
    if (splitIdx < maxLen / 2) {
      // Force split at maxLen
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
