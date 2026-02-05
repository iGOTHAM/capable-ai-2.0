/**
 * Chat engine — shared LLM loop for SSE streaming, blocking API, and Telegram.
 *
 * Extracted from the chat route to allow multiple entry points (HTTP, Telegram)
 * to share the same agentic loop, system prompt construction, and concurrency guard.
 */

import { readFile } from "fs/promises";
import path from "path";
import { appendEvent, getChatMessages, type Event } from "@/lib/events";
import { readConfig } from "@/lib/openclaw";
import { streamOpenAI } from "@/lib/llm/openai-stream";
import { streamAnthropic } from "@/lib/llm/anthropic-stream";
import type { SSEEvent, ToolCallRecord } from "@/lib/llm/types";

// Re-export types for consumers
export type { SSEEvent, ToolCallRecord } from "@/lib/llm/types";

// ─── Constants ──────────────────────────────────────────────────────────────

const WORKSPACE = process.env.OPENCLAW_DIR || "/root/.openclaw";
const MAX_HISTORY = 50;

// ─── Concurrency ────────────────────────────────────────────────────────────

let activeLoops = 0;

export function isBusy(): boolean {
  return activeLoops >= 1;
}

// ─── Result type ────────────────────────────────────────────────────────────

export interface ChatResult {
  response: string;
  toolCalls: ToolCallRecord[];
  runId: string;
}

// ─── Internal LLM types (for history conversion) ───────────────────────────

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, string> }>;
}

// ─── File loading ───────────────────────────────────────────────────────────

async function loadFile(name: string): Promise<string> {
  try {
    return await readFile(path.join(WORKSPACE, "workspace", name), "utf-8");
  } catch {
    return "";
  }
}

async function loadKnowledge(): Promise<string> {
  try {
    const { readdir } = await import("fs/promises");
    const dir = path.join(WORKSPACE, "workspace", "knowledge");
    const files = await readdir(dir);
    const contents: string[] = [];
    for (const f of files) {
      if (f.endsWith(".md")) {
        const text = await readFile(path.join(dir, f), "utf-8");
        contents.push(text);
      }
    }
    return contents.join("\n\n");
  } catch {
    return "";
  }
}

async function loadFileList(): Promise<string> {
  try {
    const { readdir, stat } = await import("fs/promises");
    const lines: string[] = [];

    const uploadsDir = path.join(WORKSPACE, "workspace", "uploads");
    try {
      const uploads = await readdir(uploadsDir);
      if (uploads.length > 0) {
        lines.push("## Uploaded Files");
        for (const f of uploads) {
          const s = await stat(path.join(uploadsDir, f));
          lines.push(`- uploads/${f} (${(s.size / 1024).toFixed(1)}KB)`);
        }
      }
    } catch { /* no uploads dir */ }

    const dealsDir = path.join(WORKSPACE, "workspace", "deals");
    try {
      const deals = await readdir(dealsDir);
      for (const deal of deals) {
        const dealPath = path.join(dealsDir, deal);
        const dealStat = await stat(dealPath);
        if (dealStat.isDirectory()) {
          const files = await readdir(dealPath);
          if (files.length > 0) {
            lines.push(`## Deal: ${deal}`);
            for (const f of files) {
              const s = await stat(path.join(dealPath, f));
              lines.push(`- deals/${deal}/${f} (${(s.size / 1024).toFixed(1)}KB)`);
            }
          }
        }
      }
    } catch { /* no deals dir */ }

    return lines.length > 0 ? lines.join("\n") : "";
  } catch {
    return "";
  }
}

export function buildSystemPrompt(
  soul: string,
  agents: string,
  memory: string,
  knowledge: string,
  fileList?: string,
): string {
  const parts: string[] = [];
  if (soul) parts.push(soul);
  if (agents) parts.push(agents);
  if (memory) parts.push(memory);
  if (knowledge) parts.push(`# Knowledge Base\n\n${knowledge}`);
  if (fileList) parts.push(`# Workspace Files\n\nThese files are available via the read_file tool:\n\n${fileList}`);
  parts.push(
    "You have access to tools:\n" +
      "- web_search: Search the internet for current information\n" +
      "- fetch_url: Read web pages\n" +
      "- read_file: Read uploaded files and deal documents (e.g. read_file({path: 'uploads/report.pdf'}))\n" +
      "- write_file: Save analysis outputs to deal folders (e.g. write_file({path: 'deals/acme/notes.md', content: '...'}))\n\n" +
      "Use web_search and fetch_url for current information. Always cite your sources.\n" +
      "Use read_file to analyze documents the user has uploaded.\n" +
      "Use write_file to save analysis, memos, and notes to deal folders.",
  );
  return parts.join("\n\n---\n\n");
}

/** Load all pack files and build the system prompt */
export async function loadSystemPrompt(): Promise<string> {
  const [soul, agents, memory, knowledge, fileList] = await Promise.all([
    loadFile("SOUL.md"),
    loadFile("AGENTS.md"),
    loadFile("MEMORY.md"),
    loadKnowledge(),
    loadFileList(),
  ]);
  return buildSystemPrompt(soul, agents, memory, knowledge, fileList);
}

// ─── History helpers ────────────────────────────────────────────────────────

function chatEventsToOpenAI(events: Event[], userMessage: string): OpenAIMessage[] {
  const recent = events.slice(-MAX_HISTORY);
  const messages: OpenAIMessage[] = recent.map((e) => ({
    role: (e.type === "chat.user_message" ? "user" : "assistant") as "user" | "assistant",
    content: e.summary,
  }));
  messages.push({ role: "user", content: userMessage });
  return messages;
}

function chatEventsToAnthropic(events: Event[], userMessage: string): AnthropicMessage[] {
  const recent = events.slice(-MAX_HISTORY);
  const messages: AnthropicMessage[] = recent.map((e) => ({
    role: (e.type === "chat.user_message" ? "user" : "assistant") as "user" | "assistant",
    content: e.summary,
  }));
  messages.push({ role: "user", content: userMessage });
  return messages;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * streamMessage — async generator yielding SSE events with real token-level streaming.
 * Used by the SSE chat route for real-time UI updates.
 *
 * Handles: config loading, concurrency, history, event logging.
 * Caller is responsible for auth checks.
 */
export async function* streamMessage(message: string): AsyncGenerator<SSEEvent> {
  const config = await readConfig();
  if (!config?.provider || !config?.apiKey || !config?.model) {
    yield { type: "error", message: "Agent not configured. Complete setup first." };
    return;
  }

  if (isBusy()) {
    yield { type: "error", message: "Agent is busy processing another message. Please wait." };
    return;
  }

  const runId = "chat-" + Date.now();

  await appendEvent({
    ts: new Date().toISOString(),
    runId,
    type: "chat.user_message",
    summary: message,
  });

  activeLoops++;
  try {
    const systemPrompt = await loadSystemPrompt();
    const chatHistory = await getChatMessages();

    let stream: AsyncGenerator<SSEEvent>;

    if (config.provider === "anthropic") {
      const historyMessages = chatEventsToAnthropic(chatHistory, message);
      stream = streamAnthropic(config.apiKey, config.model, systemPrompt, historyMessages, runId);
    } else {
      const historyMessages = chatEventsToOpenAI(chatHistory, message);
      stream = streamOpenAI(config.apiKey, config.model, systemPrompt, historyMessages, runId);
    }

    let lastDoneEvent: SSEEvent | null = null;

    for await (const event of stream) {
      yield event;

      if (event.type === "done") {
        lastDoneEvent = event;
      }
    }

    // Log bot response
    if (lastDoneEvent && lastDoneEvent.type === "done") {
      if (lastDoneEvent.toolCalls.length > 0) {
        await appendEvent({
          ts: new Date().toISOString(),
          runId,
          type: "chat.bot_message",
          summary: lastDoneEvent.fullText,
          details: { toolCalls: lastDoneEvent.toolCalls.map((tc) => ({ name: tc.name, args: tc.args })) },
        });
      } else {
        await appendEvent({
          ts: new Date().toISOString(),
          runId,
          type: "chat.bot_message",
          summary: lastDoneEvent.fullText,
        });
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to get response";

    await appendEvent({
      ts: new Date().toISOString(),
      runId,
      type: "error",
      summary: `Chat error: ${errorMsg}`,
    });

    yield { type: "error", message: errorMsg };
  } finally {
    activeLoops--;
  }
}

/**
 * processMessage — non-streaming, blocking chat handler.
 * Used by the Telegram adapter and any context that needs a complete response.
 *
 * Internally consumes streamMessage() and collects the result.
 */
export async function processMessage(message: string): Promise<ChatResult> {
  let fullText = "";
  let toolCalls: ToolCallRecord[] = [];
  const runId = "chat-" + Date.now();

  for await (const event of streamMessage(message)) {
    switch (event.type) {
      case "token":
        fullText += event.text;
        break;
      case "done":
        fullText = event.fullText;
        toolCalls = event.toolCalls;
        break;
      case "error":
        throw new Error(event.message);
    }
  }

  return { response: fullText, toolCalls, runId };
}
