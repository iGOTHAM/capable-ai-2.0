"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatPopup() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchToken = useCallback(async () => {
    if (token) return; // Already have it
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/gateway-token");
      if (!res.ok) throw new Error("Token fetch failed");
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch token on first open
  useEffect(() => {
    if (open && !token && !loading) {
      fetchToken();
    }
  }, [open, token, loading, fetchToken]);

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
            : "bg-primary text-primary-foreground",
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
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Chat</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Connecting...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex h-full items-center justify-center px-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Could not connect to the agent. It may still be starting up.
                  </p>
                  <button
                    onClick={() => {
                      setError(false);
                      setToken(null);
                      fetchToken();
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Retry
                  </button>
                  <a
                    href="/chat/"
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Open chat directly
                  </a>
                </div>
              </div>
            )}

            {token && !loading && !error && (
              <iframe
                src={`/chat/?token=${token}`}
                className="h-full w-full border-0"
                title="Chat with your AI assistant"
                allow="clipboard-write"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
