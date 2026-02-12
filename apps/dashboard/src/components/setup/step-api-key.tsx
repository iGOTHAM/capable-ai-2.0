"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { PROVIDERS, getProvider } from "@/lib/providers";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepApiKeyProps {
  data: SetupData;
  updateData: (patch: Partial<SetupData>) => void;
  onNext: () => void;
}

type Screen = "provider-grid" | "auth-config";

export function StepApiKey({ data, updateData, onNext }: StepApiKeyProps) {
  const [screen, setScreen] = useState<Screen>(
    data.provider ? "auth-config" : "provider-grid",
  );
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState("");

  const selectedProvider = data.provider ? getProvider(data.provider) : null;

  const handleSelectProvider = (providerId: string) => {
    const prov = getProvider(providerId);
    if (!prov) return;
    const defaultAuth = prov.authMethods[0]?.id ?? "api-key";
    updateData({
      provider: providerId,
      authMethod: defaultAuth,
      apiKey: "",
      model: "",
    });
    setValidated(false);
    setError("");
    setScreen("auth-config");
  };

  const handleBackToGrid = () => {
    updateData({ provider: "", authMethod: "api-key", apiKey: "", model: "" });
    setValidated(false);
    setError("");
    setScreen("provider-grid");
  };

  const handleAuthMethodChange = (method: string) => {
    updateData({ authMethod: method, apiKey: "" });
    setValidated(false);
    setError("");
  };

  const handleValidate = async () => {
    if (!data.apiKey.trim()) {
      setError(
        data.authMethod === "setup-token"
          ? "Please enter your setup token"
          : "Please enter your API key",
      );
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
          authMethod: data.authMethod,
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

  // ── Screen 1: Provider Grid ────────────────────────────────────────────

  if (screen === "provider-grid") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Label className="text-base">Choose your AI provider</Label>
          <p className="text-sm text-muted-foreground">
            Select the provider you have an account with. Your API key stays on
            this server and is never sent to Capable.ai.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PROVIDERS.map((prov) => (
            <button
              key={prov.id}
              type="button"
              onClick={() => handleSelectProvider(prov.id)}
              className="flex flex-col items-start gap-1 rounded-lg border border-input p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
            >
              <span className="font-medium text-sm">{prov.name}</span>
              <span className="text-xs text-muted-foreground leading-tight">
                {prov.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Screen 2: Auth Configuration ───────────────────────────────────────

  if (!selectedProvider) return null;

  const hasMultipleAuthMethods = selectedProvider.authMethods.length > 1;
  const isSetupToken = data.authMethod === "setup-token";

  return (
    <div className="flex flex-col gap-6">
      {/* Auth method selection (only for providers with multiple methods) */}
      {hasMultipleAuthMethods && (
        <div className="flex flex-col gap-3">
          <Label>Authentication method for {selectedProvider.name}</Label>
          <RadioGroup
            value={data.authMethod}
            onValueChange={handleAuthMethodChange}
            className="grid gap-3"
          >
            {selectedProvider.authMethods.map((method) => (
              <label
                key={method.id}
                htmlFor={`auth-${method.id}`}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  data.authMethod === method.id
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-accent/50"
                }`}
              >
                <RadioGroupItem
                  value={method.id}
                  id={`auth-${method.id}`}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium">{method.label}</div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {method.description}
                  </p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* API key / Setup token input */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="api-key">
          {isSetupToken
            ? `${selectedProvider.name} Setup Token`
            : `${selectedProvider.name} API Key`}
        </Label>
        <div className="flex gap-2">
          <Input
            id="api-key"
            type="password"
            placeholder={
              isSetupToken
                ? "Paste your setup token..."
                : selectedProvider.keyPlaceholder || "Enter your API key..."
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
          {isSetupToken ? (
            <>
              Run{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                openclaw setup-token
              </code>{" "}
              in your terminal to generate a token, or get one from your Claude
              account settings.
            </>
          ) : (
            <>
              Your API key stays on this server and is never sent to
              Capable.ai.
              {selectedProvider.docsUrl && (
                <>
                  {" "}
                  Get one at{" "}
                  <a
                    href={selectedProvider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {new URL(selectedProvider.docsUrl).hostname.replace(
                      "www.",
                      "",
                    )}
                  </a>
                </>
              )}
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
          <AlertDescription>
            {isSetupToken ? "Setup token accepted!" : "API key is valid!"}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleBackToGrid}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!validated} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
