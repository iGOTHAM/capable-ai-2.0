"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, X, Loader2, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatPopup() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIframeLoaded(false);
    try {
      const res = await fetch("/api/gateway-token");
      if (!res.ok) {
        if (res.status === 503) {
          setError("Agent is not running yet. Start your agent first.");
        } else {
          setError("Could not connect to agent gateway.");
        }
        return;
      }
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
      } else {
        setError("No gateway token available. Agent may not be configured.");
      }
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch token on first open
  useEffect(() => {
    if (open && !token && !loading && !error) {
      fetchToken();
    }
  }, [open, token, loading, error, fetchToken]);

  const handleRetry = () => {
    setToken(null);
    setError(null);
    fetchToken();
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
          <div className="flex-1 overflow-hidden relative">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Connecting to agent...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex h-full items-center justify-center px-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <WifiOff className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {error}
                  </p>
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                  <a
                    href="/chat/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    Open chat in new tab
                  </a>
                </div>
              </div>
            )}

            {token && !loading && !error && (
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-card">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">
                        Loading chat...
                      </p>
                    </div>
                  </div>
                )}
                <iframe
                  src={`/chat/?token=${token}`}
                  className="h-full w-full border-0"
                  title="Chat with your AI assistant"
                  allow="clipboard-write"
                  onLoad={() => setIframeLoaded(true)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
