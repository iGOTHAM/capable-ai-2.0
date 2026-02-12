"use client";

import { useState } from "react";
import { Loader2, ExternalLink, Settings2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AdvancedConfigCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpenControlUI = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/gateway-token");
      if (!res.ok) throw new Error("Failed to fetch token");
      const data = await res.json();
      if (!data.token) throw new Error("No token available");

      const url = `${window.location.origin}/chat/?token=${data.token}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError(
        "Could not connect to the agent. It may still be starting up."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-lg font-semibold">Advanced Configuration</span>
        <Badge variant="secondary" className="text-[10px]">
          Power Users
        </Badge>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Access the full OpenClaw Control UI for advanced settings including
        skills, security policies, memory management, and node inspection.
      </p>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs text-muted-foreground">
          Changes made in the native Control UI may conflict with settings
          managed by this dashboard. Use with caution.
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <Button
        variant="outline"
        onClick={handleOpenControlUI}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4" />
        )}
        Open Control UI
      </Button>
    </div>
  );
}
