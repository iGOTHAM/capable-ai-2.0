"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepLaunchProps {
  data: SetupData;
  onBack: () => void;
}

type LaunchPhase =
  | "idle"
  | "writing-config"
  | "starting-agent"
  | "verifying"
  | "success"
  | "error";

const PHASE_LABELS: Record<LaunchPhase, string> = {
  idle: "",
  "writing-config": "Writing configuration...",
  "starting-agent": "Starting your AI agent...",
  verifying: "Verifying connection...",
  success: "Your agent is live!",
  error: "Something went wrong",
};

const MODEL_NAMES: Record<string, string> = {
  "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5",
  "claude-sonnet-4-20250514": "Claude Sonnet 4",
  "claude-opus-4-20250514": "Claude Opus 4",
  "claude-haiku-4-20250414": "Claude Haiku 4",
  "gpt-5.2": "GPT-5.2",
  "gpt-5-mini": "GPT-5 Mini",
  "gpt-4.1": "GPT-4.1",
  "gpt-4.1-mini": "GPT-4.1 Mini",
  "o4-mini": "o4-mini",
};

export function StepLaunch({ data, onBack }: StepLaunchProps) {
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [error, setError] = useState("");

  const handleLaunch = async () => {
    setError("");

    try {
      setPhase("writing-config");
      await new Promise((r) => setTimeout(r, 500));

      setPhase("starting-agent");
      const res = await fetch("/api/setup/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: data.provider,
          apiKey: data.apiKey,
          model: data.model,
          telegramToken: data.telegramToken || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setPhase("error");
        setError(result.error || "Failed to launch agent");
        return;
      }

      setPhase("verifying");
      await new Promise((r) => setTimeout(r, 1000));

      setPhase("success");
    } catch {
      setPhase("error");
      setError("Failed to connect. Please try again.");
    }
  };

  const isLaunching =
    phase === "writing-config" ||
    phase === "starting-agent" ||
    phase === "verifying";

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="rounded-lg border border-input bg-muted/30 p-4">
        <h3 className="mb-3 text-sm font-medium">Configuration Summary</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Provider</dt>
          <dd className="font-medium capitalize">{data.provider}</dd>
          <dt className="text-muted-foreground">Model</dt>
          <dd className="font-medium">
            {MODEL_NAMES[data.model] || data.model}
          </dd>
          <dt className="text-muted-foreground">Telegram</dt>
          <dd className="font-medium">
            {data.telegramToken ? "Connected" : "Not configured"}
          </dd>
        </dl>
      </div>

      {/* Launch status */}
      {phase !== "idle" && phase !== "error" && (
        <div className="flex items-center gap-3 rounded-lg border border-input p-4">
          {phase === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          )}
          <span className="text-sm font-medium">{PHASE_LABELS[phase]}</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {phase === "success" ? (
        <Button
          onClick={() => (window.location.href = "/tasks")}
          className="w-full gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Start Chatting
        </Button>
      ) : (
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={isLaunching}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={isLaunching}
            className="flex-1 gap-2"
          >
            {isLaunching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                Launch Your Agent
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
