"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  MessageCircle,
  X,
  Loader2,
  WifiOff,
  RefreshCw,
  Send,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  streaming?: boolean;
}

type WsState = "disconnected" | "connecting" | "connected" | "error";

let reqIdCounter = 0;
function nextReqId() {
  return `dash-${Date.now()}-${++reqIdCounter}`;
}

export function ChatPopup() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [wsState, setWsState] = useState<WsState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamBufRef = useRef("");
  const currentRunIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch gateway token
  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/gateway-token");
      if (!res.ok) return null;
      const data = await res.json();
      return data.token || null;
    } catch {
      return null;
    }
  }, []);

  // Connect WebSocket to OpenClaw gateway
  const connectWs = useCallback(
    (gatewayToken: string) => {
      if (wsRef.current) {
        wsRef.current.close();
      }

      setWsState("connecting");
      setError(null);

      // Build WebSocket URL — connect to same host, Caddy proxies WS to gateway
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${window.location.host}/`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send connect handshake — must match OpenClaw gateway schema
        const connectFrame = {
          type: "req",
          id: nextReqId(),
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "openclaw-control-ui",
              version: "1.0.0",
              platform: "web",
              mode: "webchat",
            },
            role: "operator",
            scopes: [
              "operator.admin",
              "operator.approvals",
              "operator.pairing",
            ],
            caps: [],
            auth: { token: gatewayToken },
            userAgent: navigator.userAgent,
            locale: navigator.language,
          },
        };
        ws.send(JSON.stringify(connectFrame));
      };

      ws.onmessage = (evt) => {
        try {
          const frame = JSON.parse(evt.data);

          // Handle response frames (connect result, chat.send result, etc.)
          if (frame.type === "res") {
            if (frame.ok !== undefined) {
              if (frame.ok) {
                setWsState("connected");
              } else {
                setWsState("error");
                setError(
                  frame.error?.message ||
                    "Failed to authenticate with agent."
                );
              }
            }
            return;
          }

          // Handle event frames from the gateway
          if (frame.type === "event") {
            // Chat events — streaming response from the agent
            if (frame.event === "chat") {
              const payload = frame.payload;
              if (!payload) return;

              // Extract text from OpenAI-format message
              const extractText = (
                msg: Record<string, unknown> | undefined
              ): string => {
                if (!msg) return "";
                const content = msg.content;
                if (typeof content === "string") return content;
                if (Array.isArray(content)) {
                  return content
                    .map((c: Record<string, unknown>) =>
                      c.type === "text" && typeof c.text === "string"
                        ? c.text
                        : ""
                    )
                    .join("");
                }
                return "";
              };

              if (payload.state === "delta") {
                // Streaming — message contains full text so far
                const text = extractText(
                  payload.message as Record<string, unknown> | undefined
                );
                if (text) {
                  updateStreamingMessage(text);
                }
                if (payload.runId) {
                  currentRunIdRef.current = payload.runId;
                }
              } else if (payload.state === "final") {
                // Done streaming
                const text = extractText(
                  payload.message as Record<string, unknown> | undefined
                );
                if (text) {
                  finishStream(text);
                } else if (streamBufRef.current) {
                  finishStream(streamBufRef.current);
                }
                setSending(false);
                currentRunIdRef.current = null;
              } else if (
                payload.state === "error" ||
                payload.state === "aborted"
              ) {
                if (streamBufRef.current) {
                  finishStream(streamBufRef.current);
                }
                setSending(false);
                currentRunIdRef.current = null;
              }
              return;
            }

            // Ignore other event types (presence, cron, etc.)
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        setWsState("error");
        setError("WebSocket connection failed.");
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          setWsState("disconnected");
        }
      };
    },
    []
  );

  // Update the last streaming message in place
  const updateStreamingMessage = (text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.streaming) {
        return [...prev.slice(0, -1), { ...last, content: text }];
      }
      // Add new streaming message
      return [
        ...prev,
        { role: "assistant", content: text, ts: Date.now(), streaming: true },
      ];
    });
  };

  // Finalize streaming message
  const finishStream = (text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.streaming) {
        return [
          ...prev.slice(0, -1),
          { role: "assistant", content: text, ts: Date.now(), streaming: false },
        ];
      }
      return [
        ...prev,
        { role: "assistant", content: text, ts: Date.now(), streaming: false },
      ];
    });
    streamBufRef.current = "";
    setSending(false);
  };

  // Open chat: fetch token + connect
  useEffect(() => {
    if (open && !token) {
      (async () => {
        const t = await fetchToken();
        if (t) {
          setToken(t);
          connectWs(t);
        } else {
          setError("Could not get gateway token. Agent may not be configured.");
          setWsState("error");
        }
      })();
    } else if (open && token && wsState === "disconnected") {
      connectWs(token);
    }
  }, [open, token, wsState, fetchToken, connectWs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const handleRetry = () => {
    setToken(null);
    setError(null);
    setWsState("disconnected");
  };

  // Send a message
  const handleSend = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsState !== "connected" || sending) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, ts: Date.now() },
    ]);
    setInput("");
    setSending(true);
    streamBufRef.current = "";

    // Send chat message via OpenClaw gateway protocol
    const reqId = nextReqId();
    const frame = {
      type: "req",
      id: reqId,
      method: "chat.send",
      params: {
        sessionKey: "main",
        message: text,
        deliver: false,
        idempotencyKey: reqId,
      },
    };
    wsRef.current.send(JSON.stringify(frame));

    // Focus input
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all",
          "hover:scale-105 active:scale-95",
          open
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground"
        )}
        title={open ? "Close chat" : "Chat with your agent"}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </button>

      {/* Chat popup panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  wsState === "connected"
                    ? "bg-green-500"
                    : wsState === "connecting"
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-red-500"
                )}
              />
              <span className="text-sm font-semibold">Chat</span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="/chat/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Open full chat"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {/* Connecting state */}
            {wsState === "connecting" && (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Connecting to agent...
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {wsState === "error" && (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <WifiOff className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {error || "Connection lost."}
                  </p>
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Connected: show messages */}
            {wsState === "connected" && messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <p className="text-xs text-muted-foreground/60">
                  Send a message to start chatting
                </p>
              </div>
            )}

            {wsState === "connected" &&
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {msg.content}
                    {msg.streaming && (
                      <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-current opacity-60" />
                    )}
                  </div>
                </div>
              ))}

            {/* Thinking indicator */}
            {sending && !messages[messages.length - 1]?.streaming && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2">
                  <div className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          {wsState === "connected" && (
            <div className="border-t px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={sending ? "Agent is thinking..." : "Type a message..."}
                  disabled={sending}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    input.trim() && !sending
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground/30"
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
