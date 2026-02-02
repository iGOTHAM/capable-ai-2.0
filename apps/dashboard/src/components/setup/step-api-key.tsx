"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { SetupData, Provider } from "@/app/(setup)/setup/page";

interface StepApiKeyProps {
  data: SetupData;
  updateData: (patch: Partial<SetupData>) => void;
  onNext: () => void;
}

export function StepApiKey({ data, updateData, onNext }: StepApiKeyProps) {
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState("");

  const handleValidate = async () => {
    if (!data.apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }

    setValidating(true);
    setError("");
    setValidated(false);

    try {
      const res = await fetch("/api/setup/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: data.provider,
          apiKey: data.apiKey.trim(),
        }),
      });

      const result = await res.json();

      if (result.valid) {
        setValidated(true);
      } else {
        setError(result.error || "Invalid API key");
      }
    } catch {
      setError("Failed to validate key. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    updateData({ provider: provider as Provider, apiKey: "", model: "" });
    setValidated(false);
    setError("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Label>AI Provider</Label>
        <RadioGroup
          value={data.provider}
          onValueChange={handleProviderChange}
          className="grid grid-cols-2 gap-3"
        >
          <label
            htmlFor="provider-anthropic"
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
              data.provider === "anthropic"
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-accent/50"
            }`}
          >
            <RadioGroupItem value="anthropic" id="provider-anthropic" />
            <div>
              <div className="font-medium">Anthropic</div>
              <div className="text-xs text-muted-foreground">
                Claude models (recommended)
              </div>
            </div>
          </label>
          <label
            htmlFor="provider-openai"
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
              data.provider === "openai"
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-accent/50"
            }`}
          >
            <RadioGroupItem value="openai" id="provider-openai" />
            <div>
              <div className="font-medium">OpenAI</div>
              <div className="text-xs text-muted-foreground">GPT models</div>
            </div>
          </label>
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="api-key">
          {data.provider === "anthropic" ? "Anthropic" : "OpenAI"} API Key
        </Label>
        <div className="flex gap-2">
          <Input
            id="api-key"
            type="password"
            placeholder={
              data.provider === "anthropic" ? "sk-ant-..." : "sk-..."
            }
            value={data.apiKey}
            onChange={(e) => {
              updateData({ apiKey: e.target.value });
              setValidated(false);
              setError("");
            }}
          />
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={validating || !data.apiKey.trim()}
            className="shrink-0"
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : validated ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              "Validate"
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Your API key stays on this server and is never sent to Capable.ai.
          {data.provider === "anthropic" ? (
            <>
              {" "}
              Get one at{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                console.anthropic.com
              </a>
            </>
          ) : (
            <>
              {" "}
              Get one at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                platform.openai.com
              </a>
            </>
          )}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {validated && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>API key is valid!</AlertDescription>
        </Alert>
      )}

      <Button onClick={onNext} disabled={!validated} className="w-full">
        Continue
      </Button>
    </div>
  );
}
