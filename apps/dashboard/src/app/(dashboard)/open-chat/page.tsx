"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, MessageSquare, Loader2 } from "lucide-react";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(true);
  const [tokenError, setTokenError] = useState(false);

  // On mount, try to fetch gateway token and auto-redirect to OpenClaw UI
  useEffect(() => {
    const tryRedirect = async () => {
      try {
        const res = await fetch("/api/gateway-token");
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            // Full navigation — Caddy routes /chat/ to OpenClaw on port 18789
            window.location.href = `/chat/?token=${data.token}`;
            return; // Don't set redirecting=false; page is navigating away
          }
        }
      } catch {
        // Token fetch failed
      }
      // If we get here, redirect failed — show the fallback UI
      setRedirecting(false);
      setTokenError(true);
    };

    tryRedirect();
  }, []);

  // Load chat history (runs alongside the redirect attempt)
  useEffect(() => {
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(
            data.messages.map(
              (m: {
                type: string;
                summary: string;
                ts: string;
              }) => ({
                role:
                  m.type === "chat.user_message" ? "user" : "assistant",
                content: m.summary,
                ts: m.ts,
              }),
            ),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Show loading spinner while trying to redirect
  if (redirecting) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Opening chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Chat is now handled by the OpenClaw agent.
        </p>
      </div>

      {/* OpenClaw CTA */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">OpenClaw Web UI</p>
              <p className="text-sm text-muted-foreground">
                {tokenError
                  ? "Could not auto-open chat. Click below to open it manually."
                  : "Your AI assistant runs natively through OpenClaw with full capabilities — web search, file I/O, exec, browser automation, and more."}
              </p>
            </div>
          </div>
          <Button asChild>
            <a href="/chat/">
              Open Chat
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Chat history (read-only) */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="border-b px-4 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Previous Conversations
            </p>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="flex flex-col gap-3">
              {loading && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Loading history...
                </p>
              )}
              {!loading && messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No chat history yet. Open the OpenClaw Web UI to start
                  a conversation.
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
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
