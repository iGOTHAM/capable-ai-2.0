import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { appendEvent, getChatMessages } from "@/lib/events";
import { readConfig } from "@/lib/openclaw";
import { readFile } from "fs/promises";
import path from "path";
import { getOpenAITools, getAnthropicTools, executeTool } from "@/lib/tools";

const WORKSPACE = process.env.OPENCLAW_DIR || "/root/.openclaw";
const MAX_TOOL_LOOPS = 10;

// Simple concurrency limiter (1 active loop at a time for 1GB droplet)
let activeLoops = 0;

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
  parts.push(
    "You have access to tools: web_search (search the internet) and fetch_url (read web pages). " +
    "Use them whenever you need current information, facts, or to read URLs the user shares. " +
    "Always cite your sources when using search results."
  );
  return parts.join("\n\n---\n\n");
}

// --- OpenAI types ---

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
}

// --- Anthropic types ---

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, string>;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
}

// --- Tool call tracking for UI ---

interface ToolCallRecord {
  name: string;
  args: Record<string, string>;
  result: string;
}

// --- OpenAI agentic loop ---

async function runOpenAILoop(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: OpenAIMessage[],
  runId: string,
): Promise<{ response: string; toolCalls: ToolCallRecord[] }> {
  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory,
  ];
  const tools = getOpenAITools();
  const allToolCalls: ToolCallRecord[] = [];

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: 4096,
        messages,
        tools,
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
    }

    const data = (await res.json()) as OpenAIResponse;
    const choice = data.choices[0];

    if (!choice) throw new Error("No response from OpenAI");

    // Add assistant message to conversation
    const assistantMsg: OpenAIMessage = {
      role: "assistant",
      content: choice.message.content,
    };
    if (choice.message.tool_calls) {
      assistantMsg.tool_calls = choice.message.tool_calls;
    }
    messages.push(assistantMsg);

    // If no tool calls, we're done
    if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls?.length) {
      return {
        response: choice.message.content || "No response generated.",
        toolCalls: allToolCalls,
      };
    }

    // Execute each tool call
    for (const tc of choice.message.tool_calls) {
      let args: Record<string, string>;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      await appendEvent({
        ts: new Date().toISOString(),
        runId,
        type: "tool.called",
        summary: `${tc.function.name}(${JSON.stringify(args)})`,
      });

      let result: string;
      try {
        result = await executeTool(tc.function.name, args);
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`;
      }

      allToolCalls.push({ name: tc.function.name, args, result });

      await appendEvent({
        ts: new Date().toISOString(),
        runId,
        type: "tool.result",
        summary: `${tc.function.name} → ${result.slice(0, 200)}`,
      });

      messages.push({
        role: "tool",
        content: result,
        tool_call_id: tc.id,
      });
    }
  }

  // Hit max loops — return whatever we have
  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  return {
    response: (lastAssistant?.content as string) || "I ran out of tool iterations. Here's what I found so far.",
    toolCalls: allToolCalls,
  };
}

// --- Anthropic agentic loop ---

async function runAnthropicLoop(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: AnthropicMessage[],
  runId: string,
): Promise<{ response: string; toolCalls: ToolCallRecord[] }> {
  const messages: AnthropicMessage[] = [...chatHistory];
  const tools = getAnthropicTools();
  const allToolCalls: ToolCallRecord[] = [];

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
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
        messages,
        tools,
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message || `Anthropic API error: ${res.status}`);
    }

    const data = (await res.json()) as AnthropicResponse;

    // Add assistant response to messages
    messages.push({ role: "assistant", content: data.content });

    // If no tool use, extract text and return
    if (data.stop_reason !== "tool_use") {
      const textBlock = data.content.find((b) => b.type === "text");
      return {
        response: textBlock?.text || "No response generated.",
        toolCalls: allToolCalls,
      };
    }

    // Execute tool calls
    const toolUseBlocks = data.content.filter((b) => b.type === "tool_use");
    const toolResults: AnthropicContentBlock[] = [];

    for (const tb of toolUseBlocks) {
      const args = (tb.input || {}) as Record<string, string>;

      await appendEvent({
        ts: new Date().toISOString(),
        runId,
        type: "tool.called",
        summary: `${tb.name}(${JSON.stringify(args)})`,
      });

      let result: string;
      try {
        result = await executeTool(tb.name!, args);
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`;
      }

      allToolCalls.push({ name: tb.name!, args, result });

      await appendEvent({
        ts: new Date().toISOString(),
        runId,
        type: "tool.result",
        summary: `${tb.name} → ${result.slice(0, 200)}`,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: tb.id!,
        content: result,
      } as unknown as AnthropicContentBlock);
    }

    // Send tool results back as user message
    messages.push({ role: "user", content: toolResults });
  }

  // Hit max loops
  return {
    response: "I ran out of tool iterations. Here's what I found so far.",
    toolCalls: allToolCalls,
  };
}

// --- Route handlers ---

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

  // Concurrency limiter
  if (activeLoops >= 1) {
    return NextResponse.json(
      { error: "Agent is busy processing another message. Please wait." },
      { status: 429 },
    );
  }

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 },
    );
  }

  const config = await readConfig();
  if (!config?.provider || !config?.apiKey || !config?.model) {
    return NextResponse.json(
      { error: "Agent not configured. Complete setup first." },
      { status: 400 },
    );
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
    const [soul, agents, memory, knowledge] = await Promise.all([
      loadFile("SOUL.md"),
      loadFile("AGENTS.md"),
      loadFile("MEMORY.md"),
      loadKnowledge(),
    ]);

    const systemPrompt = buildSystemPrompt(soul, agents, memory, knowledge);

    // Build conversation history
    const chatHistory = await getChatMessages();
    const recentHistory = chatHistory.slice(-50);

    let result: { response: string; toolCalls: ToolCallRecord[] };

    if (config.provider === "anthropic") {
      const historyMessages: AnthropicMessage[] = recentHistory.map((e) => ({
        role: (e.type === "chat.user_message" ? "user" : "assistant") as "user" | "assistant",
        content: e.summary,
      }));
      historyMessages.push({ role: "user", content: message });

      result = await runAnthropicLoop(config.apiKey, config.model, systemPrompt, historyMessages, runId);
    } else {
      const historyMessages: OpenAIMessage[] = recentHistory.map((e) => ({
        role: (e.type === "chat.user_message" ? "user" : "assistant") as "user" | "assistant",
        content: e.summary,
      }));
      historyMessages.push({ role: "user", content: message });

      result = await runOpenAILoop(config.apiKey, config.model, systemPrompt, historyMessages, runId);
    }

    // Build the bot message: include tool call summaries if any
    let botMessage = result.response;
    if (result.toolCalls.length > 0) {
      // Store tool calls metadata as JSON in the event details
      await appendEvent({
        ts: new Date().toISOString(),
        runId,
        type: "chat.bot_message",
        summary: botMessage,
        details: { toolCalls: result.toolCalls.map((tc) => ({ name: tc.name, args: tc.args })) },
      });
    } else {
      await appendEvent({
        ts: new Date().toISOString(),
        runId,
        type: "chat.bot_message",
        summary: botMessage,
      });
    }

    return NextResponse.json({
      response: botMessage,
      toolCalls: result.toolCalls.map((tc) => ({
        name: tc.name,
        args: tc.args,
      })),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to get response";

    await appendEvent({
      ts: new Date().toISOString(),
      runId,
      type: "error",
      summary: `Chat error: ${errorMsg}`,
    });

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  } finally {
    activeLoops--;
  }
}
