"use client";

import { useState } from "react";
import {
  Loader2,
  ExternalLink,
  Settings2,
  AlertTriangle,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OnboardTerminal } from "./onboard-terminal";

export function AdvancedConfigCard() {
  const [terminalOpen, setTerminalOpen] = useState(false);
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
        Run the OpenClaw onboarding wizard to configure skills, security
        policies, model selection, and more — right from your browser.
      </p>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs text-muted-foreground">
          Changes made via the onboarding wizard or native Control UI may
          conflict with settings managed by this dashboard. Use with caution.
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={() => setTerminalOpen(true)} className="gap-2">
          <Terminal className="h-4 w-4" />
          Launch Onboarding Wizard
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenControlUI}
          disabled={loading}
          title="Open native Control UI in new tab"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
        </Button>
      </div>

      <OnboardTerminal open={terminalOpen} onOpenChange={setTerminalOpen} />
    </div>
  );
}
