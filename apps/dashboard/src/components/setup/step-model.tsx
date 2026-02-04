"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepModelProps {
  data: SetupData;
  updateData: (patch: Partial<SetupData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

const ANTHROPIC_MODELS: ModelOption[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    description: "Fast and highly capable — best balance of speed and quality",
    recommended: true,
  },
  {
    id: "claude-opus-4-20250514",
    name: "Claude Opus 4",
    description: "Most powerful model — best for complex reasoning tasks",
  },
  {
    id: "claude-haiku-4-20250414",
    name: "Claude Haiku 4",
    description: "Fastest responses — great for simple tasks and chat",
  },
];

const OPENAI_MODELS: ModelOption[] = [
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    description: "Latest flagship model — best coding and instruction following",
    recommended: true,
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    description: "Fast and affordable — great balance of speed and quality",
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    description: "Fastest and cheapest — ideal for simple tasks",
  },
  {
    id: "o4-mini",
    name: "o4-mini",
    description: "Reasoning model — thinks step-by-step for complex problems",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Previous generation — fast and accurate",
  },
];

export function StepModel({ data, updateData, onNext, onBack }: StepModelProps) {
  const models =
    data.provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Label>Select a model</Label>
        <RadioGroup
          value={data.model}
          onValueChange={(model) => updateData({ model })}
          className="grid gap-3"
        >
          {models.map((model) => (
            <label
              key={model.id}
              htmlFor={`model-${model.id}`}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                data.model === model.id
                  ? "border-primary bg-primary/5"
                  : "border-input hover:bg-accent/50"
              }`}
            >
              <RadioGroupItem
                value={model.id}
                id={`model-${model.id}`}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                  {model.recommended && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {model.description}
                </p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!data.model} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
