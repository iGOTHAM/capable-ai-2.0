"use client";

import { useState } from "react";
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
import { StepLaunch } from "@/components/setup/step-launch";

export type Provider = "anthropic" | "openai";

export interface SetupData {
  provider: Provider;
  apiKey: string;
  model: string;
  telegramToken: string;
}

const STEPS = [
  { title: "API Key", description: "Connect your AI provider" },
  { title: "Model", description: "Choose your AI model" },
  { title: "Channels", description: "Connect messaging (optional)" },
  { title: "Launch", description: "Start your AI agent" },
];

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<SetupData>({
    provider: "anthropic",
    apiKey: "",
    model: "",
    telegramToken: "",
  });

  const updateData = (patch: Partial<SetupData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

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
          {step === 3 && <StepLaunch data={data} onBack={back} />}
        </CardContent>
      </Card>
    </>
  );
}
