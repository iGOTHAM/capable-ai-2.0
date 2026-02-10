"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface AgentPublicInfo {
  name: string;
  emoji: string;
  tagline: string;
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<AgentPublicInfo>({
    name: "Atlas",
    emoji: "\u{1F916}",
    tagline: "Your AI Assistant",
  });

  useEffect(() => {
    fetch("/api/agent-public")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAgent({
            name: data.name || "Atlas",
            emoji: data.emoji || "\u{1F916}",
            tagline: data.tagline || "Your AI Assistant",
          });
        }
      })
      .catch(() => {
        // Ignore — keep defaults
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = "/timeline";
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Agent avatar */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-card text-5xl shadow-lg ring-1 ring-border">
        {agent.emoji}
      </div>

      {/* Title + tagline */}
      <h1 className="text-2xl font-bold tracking-tight">
        {agent.name} Dashboard
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{agent.tagline}</p>

      {/* Login form */}
      <form
        onSubmit={handleSubmit}
        className="mt-10 flex w-full max-w-sm flex-col gap-4"
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter dashboard password"
          className="h-12 w-full rounded-xl border border-input bg-card px-4 text-[15px] text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          required
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl text-[15px] font-semibold"
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      {/* Footer */}
      <p className="mt-16 text-xs text-muted-foreground/60">
        Powered by{" "}
        <a
          href="https://capable.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Capable.ai
        </a>
      </p>
    </div>
  );
}
