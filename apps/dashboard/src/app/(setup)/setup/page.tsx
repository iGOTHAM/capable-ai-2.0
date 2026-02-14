"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StepApiKey } from "@/components/setup/step-api-key";
import { StepModel } from "@/components/setup/step-model";
import { StepChannels } from "@/components/setup/step-channels";
import { StepPersonalize } from "@/components/setup/step-personalize";
import { StepLaunch } from "@/components/setup/step-launch";
import { StepWorkspace } from "@/components/setup/step-workspace";
import { Loader2 } from "lucide-react";
import {
  loadSetupState,
  saveSetupState,
  clearSetupStorage,
} from "@/lib/setup-storage";

export type Provider = "anthropic" | "openai";

export interface SetupData {
  provider: Provider;
  apiKey: string;
  model: string;
  telegramToken: string;
  // Personalization fields
  userName: string;
  workType: string;
  commStyle: string;
  agentName: string;
}

const STEPS = [
  { title: "API Key", description: "Connect your AI provider" },
  { title: "Model", description: "Choose your AI model" },
  { title: "Channels", description: "Connect messaging (optional)" },
  { title: "Personalize", description: "Customize your agent" },
  { title: "Workspace", description: "Set up a workspace (optional)" },
  { title: "Launch", description: "Start your AI agent" },
];

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [checking, setChecking] = useState(true);

  const [data, setData] = useState<SetupData>({
    provider: "anthropic",
    apiKey: "",
    model: "",
    telegramToken: "",
    userName: "",
    workType: "",
    commStyle: "balanced",
    agentName: "Atlas",
  });

  // Restore saved progress from localStorage
  useEffect(() => {
    const saved = loadSetupState();
    if (saved) {
      setData((prev) => ({ ...prev, ...saved.data }));
      setStep(saved.step);
    }
  }, []);

  // If setup is already complete, redirect to chat
  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((status) => {
        if (
          status.setupState === "running" ||
          status.setupState === "configured"
        ) {
          clearSetupStorage();
          window.location.href = "/tasks";
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, []);

  // Persist step + data to localStorage on every change
  useEffect(() => {
    if (!checking) {
      saveSetupState(step, data);
    }
  }, [step, data, checking]);

  const updateData = useCallback((patch: Partial<SetupData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const next = useCallback(
    () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
    [],
  );
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 ${i < step ? "bg-primary" : "bg-muted"}`}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]?.title}</CardTitle>
          <CardDescription>{STEPS[step]?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <StepApiKey data={data} updateData={updateData} onNext={next} />
          )}
          {step === 1 && (
            <StepModel
              data={data}
              updateData={updateData}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 2 && (
            <StepChannels
              data={data}
              updateData={updateData}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 3 && (
            <StepPersonalize
              data={data}
              updateData={updateData}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 4 && (
            <StepWorkspace data={data} onNext={next} onBack={back} />
          )}
          {step === 5 && <StepLaunch data={data} onBack={back} />}
        </CardContent>
      </Card>
    </>
  );
}
