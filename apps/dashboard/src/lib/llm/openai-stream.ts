/**
 * OpenAI streaming agentic loop.
 * Yields SSE events as tokens arrive and tools are called.
 */

import { appendEvent } from "@/lib/events";
import { getOpenAITools, executeTool } from "@/lib/tools";
import type { SSEEvent, ToolCallRecord } from "./types";

const MAX_TOOL_LOOPS = 10;

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

interface StreamDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

interface StreamChunk {
  choices: Array<{
    delta: StreamDelta;
    finish_reason: string | null;
  }>;
}

export async function* streamOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: OpenAIMessage[],
  runId: string,
): AsyncGenerator<SSEEvent> {
  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory,
  ];
  const tools = getOpenAITools();
  const allToolCalls: ToolCallRecord[] = [];
  let fullText = "";

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
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
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      yield { type: "error", message: err.error?.message || `OpenAI API error: ${res.status}` };
      return;
    }

    // Parse SSE stream
    const reader = res.body?.getReader();
    if (!reader) {
      yield { type: "error", message: "No response stream" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let contentAccum = "";
    const toolCallAccum: Map<number, { id: string; name: string; args: string }> = new Map();
    let finishReason: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }

        const choice = chunk.choices[0];
        if (!choice) continue;

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }

        const delta = choice.delta;

        // Text content
        if (delta.content) {
          contentAccum += delta.content;
          fullText += delta.content;
          yield { type: "token", text: delta.content };
        }

        // Tool calls (streamed incrementally)
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallAccum.get(tc.index);
            if (!existing) {
              toolCallAccum.set(tc.index, {
                id: tc.id || "",
                name: tc.function?.name || "",
                args: tc.function?.arguments || "",
              });
            } else {
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name += tc.function.name;
              if (tc.function?.arguments) existing.args += tc.function.arguments;
            }
          }
        }
      }
    }

    // Build assistant message
    const assistantMsg: OpenAIMessage = {
      role: "assistant",
      content: contentAccum || null,
    };

    if (toolCallAccum.size > 0) {
      assistantMsg.tool_calls = Array.from(toolCallAccum.entries())
        .sort(([a], [b]) => a - b)
        .map(([, tc]) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.args },
        }));
    }

    messages.push(assistantMsg);

    // If no tool calls, we're done
    if (finishReason !== "tool_calls" || toolCallAccum.size === 0) {
      yield { type: "done", fullText, toolCalls: allToolCalls };
      return;
    }

    // Execute tool calls
    for (const [, tc] of Array.from(toolCallAccum.entries()).sort(([a], [b]) => a - b)) {
      let args: Record<string, string>;
      try {
        args = JSON.parse(tc.args);
      } catch {
        args = {};
      }

      yield { type: "tool_start", name: tc.name, args };

      await appendEvent({
        ts: new Date().toISOString(),
        runId,
        type: "tool.called",
        summary: `${tc.name}(${JSON.stringify(args)})`,
      });

      let result: string;
      try {
        result = await executeTool(tc.name, args);
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`;
      }

      allToolCalls.push({ name: tc.name, args, result });

      yield { type: "tool_result", name: tc.name, result: result.slice(0, 500) };

      await appendEvent({
        ts: new Date().toISOString(),
        runId,
        type: "tool.result",
        summary: `${tc.name} → ${result.slice(0, 200)}`,
      });

      messages.push({
        role: "tool",
        content: result,
        tool_call_id: tc.id,
      });
    }
  }

  // Max loops reached
  yield { type: "done", fullText: fullText || "I ran out of tool iterations.", toolCalls: allToolCalls };
}
