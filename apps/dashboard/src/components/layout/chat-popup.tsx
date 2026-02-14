"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  MessageCircle,
  X,
  Loader2,
  WifiOff,
  RefreshCw,
  Send,
  ExternalLink,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  streaming?: boolean;
  isHistory?: boolean;
}

type WsState = "disconnected" | "connecting" | "connected" | "error";

interface PendingFile {
  file: File;
  previewUrl?: string; // object URL for image thumbnails
}

// ─── Prompt Pool ────────────────────────────────────────────────────────────

const PROMPT_POOL = [
  { emoji: "👋", text: "What are you working on?" },
  { emoji: "☀️", text: "Give me a morning brief" },
  { emoji: "🎲", text: "Surprise me with something useful" },
  { emoji: "📬", text: "What happened while I was away?" },
  { emoji: "🎯", text: "What should I focus on today?" },
  { emoji: "✍️", text: "Draft something creative" },
  { emoji: "📋", text: "Review my pending tasks" },
  { emoji: "📊", text: "Any updates on the pipeline?" },
  { emoji: "🔍", text: "Research something interesting" },
  { emoji: "📅", text: "Check my calendar for today" },
  { emoji: "📝", text: "Write a quick summary" },
  { emoji: "💡", text: "Help me brainstorm" },
  { emoji: "📂", text: "What's new in my files?" },
  { emoji: "🔔", text: "Tell me something I should know" },
  { emoji: "🗓️", text: "Plan my day" },
  { emoji: "⏪", text: "Catch me up on recent activity" },
];

/** Deterministic daily shuffle — same 4 prompts all day, different tomorrow */
function getDailyPrompts(): typeof PROMPT_POOL {
  const daySeed = Math.floor(Date.now() / 86400000);
  // Simple seeded shuffle using day number
  const shuffled = [...PROMPT_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = ((daySeed * (i + 1) * 2654435761) >>> 0) % (i + 1);
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp!;
  }
  return shuffled.slice(0, 4);
}

// ─── File Upload Helpers ────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const ALLOWED_ACCEPT =
  ".pdf,.docx,.xlsx,.txt,.md,.csv,.json,.doc,.xls,.jpg,.jpeg,.png,.webp,.gif";

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(name));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ──────────────────────────────────────────────────────────────

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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [suggestsDismissed, setSuggestsDismissed] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamBufRef = useRef("");
  const currentRunIdRef = useRef<string | null>(null);
  const historyLoadedRef = useRef(false);

  // Daily-rotating suggested prompts
  const dailyPrompts = useMemo(() => getDailyPrompts(), []);

  // ── Listen for "open-chat" custom event from top bar ───────────────────
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-chat", handler);
    return () => window.removeEventListener("open-chat", handler);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset suggestions dismissed when popup reopens + auto-focus input
  useEffect(() => {
    if (open) {
      setSuggestsDismissed(false);
      setUploadError(null);
      // Focus input after popup opens (slight delay for render)
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

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

  // ── Load chat history from events.ndjson ─────────────────────────────
  const loadHistory = useCallback(async () => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    setHistoryLoading(true);

    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        const history: ChatMessage[] = data.messages.map(
          (m: { type: string; summary: string; ts: string }) => ({
            role: m.type === "chat.user_message" ? "user" as const : "assistant" as const,
            content: m.summary,
            ts: new Date(m.ts).getTime(),
            isHistory: true,
          }),
        );
        setMessages((prev) => {
          // Prepend history, avoid duplicates
          const existingTimes = new Set(prev.map((m) => m.ts));
          const unique = history.filter((h) => !existingTimes.has(h.ts));
          return [...unique, ...prev];
        });
      }
    } catch {
      // Silent fail — chat still works without history
    } finally {
      setHistoryLoading(false);
      // Scroll to bottom after history loads
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
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
                // Load history once connected
                loadHistory();
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

            // Ignore other event types
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
    [loadHistory]
  );

  // Update the last streaming message in place
  const updateStreamingMessage = (text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.streaming) {
        return [...prev.slice(0, -1), { ...last, content: text }];
      }
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
    historyLoadedRef.current = false;
  };

  // ── Send a message (with optional file upload) ─────────────────────────
  const sendViaWs = useCallback(
    (text: string) => {
      if (!wsRef.current || wsState !== "connected") return;
      const reqId = nextReqId();
      wsRef.current.send(
        JSON.stringify({
          type: "req",
          id: reqId,
          method: "chat.send",
          params: {
            sessionKey: "main",
            message: text,
            deliver: false,
            idempotencyKey: reqId,
          },
        }),
      );
    },
    [wsState],
  );

  const handleSend = async () => {
    const text = input.trim();
    const hasFile = !!pendingFile;
    if ((!text && !hasFile) || !wsRef.current || wsState !== "connected" || sending) return;

    setUploadError(null);

    // If there's a pending file, upload it first
    if (hasFile && pendingFile) {
      setUploading(true);
      setSending(true);

      try {
        const formData = new FormData();
        formData.append("file", pendingFile.file);

        const res = await fetch("/api/files", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Upload failed" }));
          setUploadError(errData.error || "Upload failed");
          setUploading(false);
          setSending(false);
          return;
        }

        const result = await res.json();
        const fileName = result.file?.name || pendingFile.file.name;

        // Clean up preview URL
        if (pendingFile.previewUrl) {
          URL.revokeObjectURL(pendingFile.previewUrl);
        }
        setPendingFile(null);

        // Build message with file reference + optional text
        const msg = text
          ? `📎 Uploaded: ${fileName}\n\n${text}`
          : `📎 Uploaded: ${fileName}`;

        setMessages((prev) => [
          ...prev,
          { role: "user", content: msg, ts: Date.now() },
        ]);
        setInput("");
        streamBufRef.current = "";
        sendViaWs(msg);
      } catch {
        setUploadError("Upload failed. Please try again.");
        setSending(false);
      } finally {
        setUploading(false);
      }
      return;
    }

    // Text-only message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, ts: Date.now() },
    ]);
    setInput("");
    setSending(true);
    streamBufRef.current = "";
    sendViaWs(text);

    inputRef.current?.focus();
  };

  // ── File selection handler ─────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    setUploadError(null);

    // Create preview for images
    let previewUrl: string | undefined;
    if (isImageFile(file.name)) {
      previewUrl = URL.createObjectURL(file);
    }

    setPendingFile({ file, previewUrl });
  };

  const cancelPendingFile = () => {
    if (pendingFile?.previewUrl) {
      URL.revokeObjectURL(pendingFile.previewUrl);
    }
    setPendingFile(null);
    setUploadError(null);
  };

  // ── Clipboard paste handler (Ctrl+V image support) ─────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        // Generate a meaningful filename from the MIME type
        const ext = file.type.split("/")[1] || "png";
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const namedFile = new File([file], `pasted-image-${timestamp}.${ext}`, {
          type: file.type,
        });

        const previewUrl = URL.createObjectURL(namedFile);
        setPendingFile({ file: namedFile, previewUrl });
        setUploadError(null);
        return;
      }
    }
  }, []);

  // ── Message action handlers ──────────────────────────────────────────
  const handleCopyMessage = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }, []);

  const handleDismissMessage = useCallback((idx: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Suggested prompt click handler ─────────────────────────────────────
  const handleSuggestClick = (text: string) => {
    if (!wsRef.current || wsState !== "connected" || sending) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, ts: Date.now() },
    ]);
    setInput("");
    setSending(true);
    streamBufRef.current = "";
    sendViaWs(text);
  };

  // Show prompts only when no messages at all (including history)
  const showSuggestions =
    wsState === "connected" &&
    messages.length === 0 &&
    !historyLoading &&
    !suggestsDismissed;

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
        <div className="fixed bottom-20 right-6 z-50 flex h-[500px] w-[380px] flex-col rounded-xl border bg-card shadow-2xl">
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
                href="/open-chat"
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
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3"
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

            {/* Loading history */}
            {wsState === "connected" && historyLoading && messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Loading conversation...
                  </p>
                </div>
              </div>
            )}

            {/* Suggested prompts — shown only when no history exists */}
            {showSuggestions && (
              <div className="flex h-full flex-col items-center justify-center gap-5 px-2">
                <p className="text-xs text-muted-foreground/60">
                  Try asking:
                </p>
                <div className="flex w-full flex-col gap-2">
                  {dailyPrompts.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => handleSuggestClick(s.text)}
                      className="group flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-left text-[13px] transition-colors hover:border-primary/20 hover:bg-muted"
                    >
                      <span>{s.emoji}</span>
                      <span className="flex-1 text-foreground/80">
                        {s.text}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSuggestsDismissed(true);
                        }}
                        className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/40 hover:!text-muted-foreground"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {wsState === "connected" &&
              messages.map((msg, i) => (
                <div
                  key={`${msg.ts}-${i}`}
                  className={cn(
                    "group/msg relative flex",
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
                  {/* Hover action buttons */}
                  {!msg.streaming && (
                    <div className={cn(
                      "absolute -top-3 hidden items-center gap-0.5 rounded-md border bg-card px-1 py-0.5 shadow-sm group-hover/msg:flex",
                      msg.role === "user" ? "right-0" : "left-0"
                    )}>
                      <button
                        onClick={() => handleCopyMessage(msg.content, i)}
                        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                        title="Copy"
                      >
                        {copiedIdx === i ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDismissMessage(i)}
                        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
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
            <div className="border-t">
              {/* Pending file preview */}
              {pendingFile && (
                <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/30">
                  {pendingFile.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pendingFile.previewUrl}
                      alt="Preview"
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {pendingFile.file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(pendingFile.file.size)}
                    </p>
                  </div>
                  <button
                    onClick={cancelPendingFile}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Upload error */}
              {uploadError && (
                <div className="px-3 py-1.5 bg-destructive/5">
                  <p className="text-[11px] text-destructive">{uploadError}</p>
                </div>
              )}

              {/* Input row */}
              <div className="flex items-center gap-2 px-3 py-2">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_ACCEPT}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || uploading}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    "text-muted-foreground hover:text-foreground hover:bg-muted",
                    (sending || uploading) && "opacity-30 pointer-events-none",
                  )}
                  title="Attach file"
                >
                  {isImageFile(pendingFile?.file.name || "") ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    uploading
                      ? "Uploading file..."
                      : sending
                        ? "Agent is thinking..."
                        : "Type a message..."
                  }
                  disabled={sending || uploading}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !pendingFile) || sending || uploading}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    (input.trim() || pendingFile) && !sending && !uploading
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground/30"
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
