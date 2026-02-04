"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(
            data.messages.map((m: { type: string; summary: string; ts: string }) => ({
              role: m.type === "chat.user_message" ? "user" : "assistant",
              content: m.summary,
              ts: m.ts,
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMsg: Message = {
      role: "user",
      content: input.trim(),
      ts: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            ts: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get a response.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${errorMsg}`,
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
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
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start" role="status" aria-label="Sending message">
                  <div className="rounded-lg bg-muted px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
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
                disabled={sending}
              />
              <Button
                type="submit"
                size="icon"
                disabled={sending}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
