"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/gateway-token")
      .then((res) => {
        if (!res.ok) throw new Error("Token fetch failed");
        return res.json();
      })
      .then((data) => {
        if (data.token) {
          setToken(data.token);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, []);

  // Loading
  if (!token && !error) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Could not connect to the agent. It may still be starting up.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="/chat/">Open Chat Directly</a>
          </Button>
        </div>
      </div>
    );
  }

  // Embedded iframe
  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)]">
      <iframe
        src={`/chat/?token=${token}`}
        className="h-full w-full border-0"
        title="Chat with your AI assistant"
        allow="clipboard-write"
      />
    </div>
  );
}
