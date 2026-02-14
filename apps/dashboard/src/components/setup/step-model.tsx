"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft } from "lucide-react";
import { getModelsForProvider } from "@capable-ai/shared";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepModelProps {
  data: SetupData;
  updateData: (patch: Partial<SetupData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepModel({ data, updateData, onNext, onBack }: StepModelProps) {
  const models = getModelsForProvider(data.provider);
  const isKnown = models.some((m) => m.id === data.model);
  const [customMode, setCustomMode] = useState(!isKnown && !!data.model);
  const [customInput, setCustomInput] = useState(
    !isKnown && data.model ? data.model : "",
  );

  const radioValue = customMode ? "custom" : data.model;

  const handleRadioChange = (value: string) => {
    if (value === "custom") {
      setCustomMode(true);
      updateData({ model: customInput });
    } else {
      setCustomMode(false);
      setCustomInput("");
      updateData({ model: value });
    }
  };

  const handleCustomInputChange = (value: string) => {
    setCustomInput(value);
    updateData({ model: value });
  };

  const canContinue = customMode ? customInput.trim().length > 0 : !!data.model;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Label>Select a model</Label>
        <p className="text-sm text-muted-foreground">
          You can change your model anytime in Settings.
        </p>
        <RadioGroup
          value={radioValue}
          onValueChange={handleRadioChange}
          className="grid gap-3"
        >
          {models.map((model) => (
            <label
              key={model.id}
              htmlFor={`model-${model.id}`}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                radioValue === model.id
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
          <label
            htmlFor="model-custom"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              radioValue === "custom"
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-accent/50"
            }`}
          >
            <RadioGroupItem
              value="custom"
              id="model-custom"
              className="mt-0.5"
            />
            <div className="flex-1">
              <span className="font-medium">Custom model</span>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Enter any model ID supported by your provider
              </p>
            </div>
          </label>
        </RadioGroup>
        {customMode && (
          <Input
            placeholder="e.g. claude-sonnet-4-5-20250929"
            value={customInput}
            onChange={(e) => handleCustomInputChange(e.target.value)}
            autoFocus
          />
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
