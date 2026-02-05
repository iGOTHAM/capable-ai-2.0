"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Globe,
  Link,
  FileText,
  FileOutput,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ToolCall {
  name: string;
  args: Record<string, string>;
}

interface ActiveTool {
  name: string;
  args: Record<string, string>;
  done: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: string;
  toolCalls?: ToolCall[];
  streaming?: boolean;
  activeTools?: ActiveTool[];
}

function getToolIcon(name: string) {
  switch (name) {
    case "web_search": return Globe;
    case "fetch_url": return Link;
    case "read_file": return FileText;
    case "write_file": return FileOutput;
    default: return Globe;
  }
}

function getToolLabel(name: string, args: Record<string, string>) {
  switch (name) {
    case "web_search": return `Searching: ${args.query || "..."}`;
    case "fetch_url": return `Fetching: ${args.url || "..."}`;
    case "read_file": return `Reading: ${args.path || "..."}`;
    case "write_file": return `Writing: ${args.path || "..."}`;
    default: return `${name}(...)`;
  }
}

function ToolCallBadge({ tool, active }: { tool: { name: string; args: Record<string, string>; done?: boolean }; active?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(tool.name);
  const label = getToolLabel(tool.name, tool.args);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-left w-full transition-colors ${
        active && !tool.done
          ? "border-primary/30 bg-primary/5 text-primary animate-pulse"
          : "border-input bg-muted/50 text-muted-foreground hover:bg-muted"
      }`}
    >
      {active && !tool.done ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      ) : (
        <Icon className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate flex-1">{label}</span>
      {expanded ? (
        <ChevronDown className="h-3 w-3 shrink-0" />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0" />
      )}
    </button>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-blockquote:my-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(
            data.messages.map((m: { type: string; summary: string; ts: string; details?: { toolCalls?: ToolCall[] } }) => ({
              role: m.type === "chat.user_message" ? "user" : "assistant",
              content: m.summary,
              ts: m.ts,
              toolCalls: m.details?.toolCalls,
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;

    const userMsg: Message = {
      role: "user",
      content: input.trim(),
      ts: new Date().toISOString(),
    };

    const msgContent = userMsg.content;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Track the assistant message index for updates
    let assistantIdx = -1;

    // Add a placeholder assistant message for streaming
    setMessages((prev) => {
      assistantIdx = prev.length;
      return [
        ...prev,
        {
          role: "assistant",
          content: "",
          ts: new Date().toISOString(),
          streaming: true,
          activeTools: [],
        },
      ];
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: msgContent }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let contentAccum = "";
      const tools: ActiveTool[] = [];
      const completedToolCalls: ToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr) as {
                type: string;
                text?: string;
                name?: string;
                args?: Record<string, string>;
                result?: string;
                fullText?: string;
                toolCalls?: ToolCall[];
                message?: string;
              };

              switch (event.type) {
                case "token":
                  contentAccum += event.text || "";
                  setMessages((prev) => {
                    const updated = [...prev];
                    const msg = updated[assistantIdx];
                    if (msg) {
                      updated[assistantIdx] = { ...msg, content: contentAccum };
                    }
                    return updated;
                  });
                  break;

                case "tool_start":
                  tools.push({
                    name: event.name || "",
                    args: event.args || {},
                    done: false,
                  });
                  setMessages((prev) => {
                    const updated = [...prev];
                    const msg = updated[assistantIdx];
                    if (msg) {
                      updated[assistantIdx] = { ...msg, activeTools: [...tools] };
                    }
                    return updated;
                  });
                  break;

                case "tool_result": {
                  const lastTool = tools[tools.length - 1];
                  if (lastTool) {
                    lastTool.done = true;
                    completedToolCalls.push({
                      name: lastTool.name,
                      args: lastTool.args,
                    });
                  }
                  setMessages((prev) => {
                    const updated = [...prev];
                    const msg = updated[assistantIdx];
                    if (msg) {
                      updated[assistantIdx] = { ...msg, activeTools: [...tools] };
                    }
                    return updated;
                  });
                  break;
                }

                case "done":
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[assistantIdx] = {
                      role: "assistant",
                      content: event.fullText || contentAccum,
                      ts: new Date().toISOString(),
                      toolCalls: event.toolCalls?.map((tc: ToolCall) => ({
                        name: tc.name,
                        args: tc.args,
                      })) || completedToolCalls,
                      streaming: false,
                    };
                    return updated;
                  });
                  break;

                case "error":
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[assistantIdx] = {
                      role: "assistant",
                      content: `Error: ${event.message || "Unknown error"}`,
                      ts: new Date().toISOString(),
                      streaming: false,
                    };
                    return updated;
                  });
                  break;
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const msg = updated[assistantIdx];
          if (msg) {
            updated[assistantIdx] = {
              ...msg,
              content: msg.content || "Response cancelled.",
              streaming: false,
            };
          }
          return updated;
        });
      } else {
        const errorMsg = err instanceof Error ? err.message : "Failed to get a response.";
        setMessages((prev) => {
          const updated = [...prev];
          const msg = updated[assistantIdx];
          if (msg) {
            updated[assistantIdx] = {
              ...msg,
              content: `Error: ${errorMsg}`,
              streaming: false,
            };
          }
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Interact with your assistant.
        </p>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div ref={scrollRef} className="flex-1 overflow-auto p-4">
            <div className="flex flex-col gap-3">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No messages yet. Start a conversation.
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        {/* Active tool badges (during streaming) */}
                        {msg.activeTools && msg.activeTools.length > 0 && (
                          <div className="flex flex-col gap-1 mb-2">
                            {msg.activeTools.map((tool, j) => (
                              <ToolCallBadge key={j} tool={tool} active />
                            ))}
                          </div>
                        )}
                        {/* Completed tool badges (after done) */}
                        {!msg.streaming && msg.toolCalls && msg.toolCalls.length > 0 && !msg.activeTools?.length && (
                          <div className="flex flex-col gap-1 mb-2">
                            {msg.toolCalls.map((tc, j) => (
                              <ToolCallBadge key={j} tool={{ ...tc, done: true }} />
                            ))}
                          </div>
                        )}
                        {msg.content ? (
                          <MarkdownContent content={msg.content} />
                        ) : msg.streaming ? (
                          <span className="inline-block w-2 h-4 bg-foreground/60 animate-pulse rounded-sm" />
                        ) : null}
                      </>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message..."
                className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={streaming}
              />
              {streaming ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={handleAbort}
                  aria-label="Stop generation"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
