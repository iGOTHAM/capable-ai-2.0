/**
 * Shared types for SSE streaming across LLM providers.
 */

export interface ToolCallRecord {
  name: string;
  args: Record<string, string>;
  result: string;
}

/** SSE event types emitted during streaming */
export type SSEEvent =
  | { type: "token"; text: string }
  | { type: "tool_start"; name: string; args: Record<string, string> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "done"; fullText: string; toolCalls: ToolCallRecord[] }
  | { type: "error"; message: string };
