import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { appendEvent, getChatMessages } from "@/lib/events";
import { readConfig } from "@/lib/openclaw";
import { readFile } from "fs/promises";
import path from "path";

const WORKSPACE = process.env.OPENCLAW_DIR || "/root/.openclaw";

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

function buildSystemPrompt(soul: string, agents: string, memory: string, knowledge: string): string {
  const parts: string[] = [];
  if (soul) parts.push(soul);
  if (agents) parts.push(agents);
  if (memory) parts.push(memory);
  if (knowledge) parts.push(`# Knowledge Base\n\n${knowledge}`);
  return parts.join("\n\n---\n\n");
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const err = (await response.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock?.text || "No response generated.";
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string> {
  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 4096,
      messages: allMessages,
    }),
  });

  if (!response.ok) {
    const err = (await response.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content || "No response generated.";
}

export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await getChatMessages();
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 },
    );
  }

  // Read config to get provider, model, and API key
  const config = await readConfig();
  if (!config?.provider || !config?.apiKey || !config?.model) {
    return NextResponse.json(
      { error: "Agent not configured. Complete setup first." },
      { status: 400 },
    );
  }

  const runId = "chat-" + Date.now();

  // Log user message
  await appendEvent({
    ts: new Date().toISOString(),
    runId,
    type: "chat.user_message",
    summary: message,
  });

  try {
    // Load pack files for system prompt
    const [soul, agents, memory, knowledge] = await Promise.all([
      loadFile("SOUL.md"),
      loadFile("AGENTS.md"),
      loadFile("MEMORY.md"),
      loadKnowledge(),
    ]);

    const systemPrompt = buildSystemPrompt(soul, agents, memory, knowledge);

    // Build conversation history from past chat events (last 50 messages)
    const chatHistory = await getChatMessages();
    const recentHistory = chatHistory.slice(-50);
    const historyMessages: ChatMessage[] = recentHistory.map((e) => ({
      role: e.type === "chat.user_message" ? "user" as const : "assistant" as const,
      content: e.summary,
    }));

    // Add current message
    historyMessages.push({ role: "user", content: message });

    // Call the appropriate LLM provider
    let botResponse: string;
    if (config.provider === "anthropic") {
      botResponse = await callAnthropic(config.apiKey, config.model, systemPrompt, historyMessages);
    } else {
      botResponse = await callOpenAI(config.apiKey, config.model, systemPrompt, historyMessages);
    }

    // Log bot response
    await appendEvent({
      ts: new Date().toISOString(),
      runId,
      type: "chat.bot_message",
      summary: botResponse,
    });

    return NextResponse.json({ response: botResponse });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to get response";

    // Log error event
    await appendEvent({
      ts: new Date().toISOString(),
      runId,
      type: "error",
      summary: `Chat error: ${errorMsg}`,
    });

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
