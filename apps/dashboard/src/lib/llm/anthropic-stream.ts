/**
 * Anthropic streaming agentic loop.
 * Yields SSE events as tokens arrive and tools are called.
 */

import { appendEvent } from "@/lib/events";
import { getAnthropicTools, executeTool } from "@/lib/tools";
import type { SSEEvent, ToolCallRecord } from "./types";

const MAX_TOOL_LOOPS = 10;

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

// Anthropic SSE event types
interface StreamEvent {
  type: string;
  index?: number;
  content_block?: { type: string; id?: string; name?: string; text?: string };
  delta?: { type: string; text?: string; partial_json?: string };
  message?: { stop_reason?: string };
}

export async function* streamAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  chatHistory: AnthropicMessage[],
  runId: string,
): AsyncGenerator<SSEEvent> {
  const messages: AnthropicMessage[] = [...chatHistory];
  const tools = getAnthropicTools();
  const allToolCalls: ToolCallRecord[] = [];
  let fullText = "";

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
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
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      yield { type: "error", message: err.error?.message || `Anthropic API error: ${res.status}` };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      yield { type: "error", message: "No response stream" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let stopReason: string | null = null;

    // Track content blocks being built
    const contentBlocks: AnthropicContentBlock[] = [];
    let currentBlockIndex = -1;
    let currentToolInput = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        let event: StreamEvent;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        switch (event.type) {
          case "content_block_start": {
            const block = event.content_block;
            if (!block) break;
            currentBlockIndex = event.index ?? contentBlocks.length;

            if (block.type === "text") {
              contentBlocks[currentBlockIndex] = { type: "text", text: "" };
            } else if (block.type === "tool_use") {
              contentBlocks[currentBlockIndex] = {
                type: "tool_use",
                id: block.id,
                name: block.name,
                input: {},
              };
              currentToolInput = "";
            }
            break;
          }

          case "content_block_delta": {
            const delta = event.delta;
            if (!delta) break;
            const idx = event.index ?? currentBlockIndex;

            if (delta.type === "text_delta" && delta.text) {
              const block = contentBlocks[idx];
              if (block?.type === "text") {
                block.text = (block.text || "") + delta.text;
              }
              fullText += delta.text;
              yield { type: "token", text: delta.text };
            }

            if (delta.type === "input_json_delta" && delta.partial_json) {
              currentToolInput += delta.partial_json;
            }
            break;
          }

          case "content_block_stop": {
            const idx = event.index ?? currentBlockIndex;
            const block = contentBlocks[idx];
            if (block?.type === "tool_use" && currentToolInput) {
              try {
                block.input = JSON.parse(currentToolInput);
              } catch {
                block.input = {};
              }
              currentToolInput = "";
            }
            break;
          }

          case "message_delta": {
            if (event.delta && (event.delta as unknown as { stop_reason?: string }).stop_reason) {
              stopReason = (event.delta as unknown as { stop_reason: string }).stop_reason;
            }
            break;
          }
        }
      }
    }

    // Build assistant message
    messages.push({ role: "assistant", content: contentBlocks });

    // If no tool use, we're done
    if (stopReason !== "tool_use") {
      yield { type: "done", fullText, toolCalls: allToolCalls };
      return;
    }

    // Execute tool calls
    const toolUseBlocks = contentBlocks.filter((b) => b.type === "tool_use");
    const toolResults: AnthropicContentBlock[] = [];

    for (const tb of toolUseBlocks) {
      const args = (tb.input || {}) as Record<string, string>;

      yield { type: "tool_start", name: tb.name!, args };

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

      yield { type: "tool_result", name: tb.name!, result: result.slice(0, 500) };

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

    messages.push({ role: "user", content: toolResults });
  }

  // Max loops reached
  yield { type: "done", fullText: fullText || "I ran out of tool iterations.", toolCalls: allToolCalls };
}
