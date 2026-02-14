"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  RotateCcw,
  Save,
  MessageCircle,
} from "lucide-react";
import { AgentIdentityCard } from "@/components/settings/agent-identity-card";
import { SoulEditorCard } from "@/components/settings/soul-editor-card";
import { PipelineStagesCard } from "@/components/settings/pipeline-stages-card";
import { WorkspaceInfoCard } from "@/components/settings/workspace-info-card";
import { GoogleWorkspaceCard } from "@/components/settings/google-workspace-card";
import { AdvancedConfigCard } from "@/components/settings/advanced-config-card";
import { PROVIDERS, getModelsForProvider } from "@capable-ai/shared";

interface ConfigData {
  provider: string;
  apiKey: string;
  model: string;
  channels: Record<string, unknown>;
}

interface DaemonStatus {
  running: boolean;
  pid?: number;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [daemon, setDaemon] = useState<DaemonStatus>({ running: false });
  const [loading, setLoading] = useState(true);

  // Provider section
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [customModelInput, setCustomModelInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  // Channel section
  const [telegramToken, setTelegramToken] = useState("");
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelMsg, setChannelMsg] = useState("");

  // Daemon section
  const [daemonAction, setDaemonAction] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [configRes, daemonRes] = await Promise.all([
        fetch("/api/openclaw/config"),
        fetch("/api/openclaw/daemon"),
      ]);

      if (configRes.ok) {
        const c = await configRes.json();
        setConfig(c);
        setProvider(c.provider || "");
        const knownModels = getModelsForProvider(c.provider || "");
        const isKnown = knownModels.some((m) => m.id === c.model);
        if (isKnown) {
          setModel(c.model || "");
          setCustomModelInput("");
        } else if (c.model) {
          setModel("custom");
          setCustomModelInput(c.model);
        } else {
          setModel("");
          setCustomModelInput("");
        }
      }

      if (daemonRes.ok) {
        const d = await daemonRes.json();
        setDaemon(d);
      }
    } catch {
      // Ignore fetch errors during load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveProvider = async () => {
    setSaving(true);
    setSaveMsg("");
    setSaveError("");

    const body: Record<string, string> = {};
    if (provider && provider !== config?.provider) body.provider = provider;
    if (apiKey) body.apiKey = apiKey;
    const resolvedModel = model === "custom" ? customModelInput.trim() : model;
    if (resolvedModel && resolvedModel !== config?.model)
      body.model = resolvedModel;

    if (Object.keys(body).length === 0) {
      setSaveError("No changes to save");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/openclaw/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (res.ok) {
        setSaveMsg("Saved! Agent restarting...");
        setApiKey("");
        await fetchData();
      } else {
        setSaveError(result.error || "Failed to save");
      }
    } catch {
      setSaveError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChannel = async () => {
    setSavingChannel(true);
    setChannelMsg("");

    try {
      const channels = telegramToken
        ? { telegram: { enabled: true, botToken: telegramToken } }
        : { telegram: { enabled: false } };

      const res = await fetch("/api/openclaw/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });

      if (res.ok) {
        setChannelMsg("Channel updated! Agent restarting...");
        setTelegramToken("");
        await fetchData();
      }
    } catch {
      // Ignore
    } finally {
      setSavingChannel(false);
    }
  };

  const handleDaemonAction = async (action: string) => {
    setDaemonAction(action);
    try {
      const res = await fetch("/api/openclaw/daemon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const result = await res.json();
        setDaemon({ running: result.running, pid: result.pid });
      }
    } catch {
      // Ignore
    } finally {
      setDaemonAction("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasTelegram =
    config?.channels &&
    typeof config.channels === "object" &&
    "telegram" in config.channels &&
    config.channels.telegram &&
    typeof config.channels.telegram === "object" &&
    "enabled" in config.channels.telegram &&
    config.channels.telegram.enabled;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your AI agent configuration
        </p>
      </div>

      {/* Agent Identity */}
      <AgentIdentityCard />

      {/* AI Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Provider</CardTitle>
          <CardDescription>
            Your agent supports any model from your provider. Pick one below or
            enter a custom model ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <RadioGroup
              value={provider}
              onValueChange={(v) => {
                setProvider(v);
                setModel("");
                setCustomModelInput("");
              }}
              className="grid grid-cols-2 gap-3"
            >
              {PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  htmlFor={`settings-${p.id}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    provider === p.id
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent/50"
                  }`}
                >
                  <RadioGroupItem value={p.id} id={`settings-${p.id}`} />
                  <span className="font-medium">{p.name}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-api-key">
              API Key{" "}
              <span className="text-xs text-muted-foreground">
                (current: {config?.apiKey || "not set"})
              </span>
            </Label>
            <Input
              id="settings-api-key"
              type="password"
              placeholder="Enter new API key to update"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <RadioGroup
              value={model}
              onValueChange={(v) => {
                setModel(v);
                if (v !== "custom") setCustomModelInput("");
              }}
              className="grid gap-2"
            >
              {getModelsForProvider(provider).map((m) => (
                <label
                  key={m.id}
                  htmlFor={`settings-model-${m.id}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    model === m.id
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent/50"
                  }`}
                >
                  <RadioGroupItem
                    value={m.id}
                    id={`settings-model-${m.id}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.name}</span>
                      {m.recommended && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {m.description}
                    </p>
                  </div>
                </label>
              ))}
              <label
                htmlFor="settings-model-custom"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                  model === "custom"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-accent/50"
                }`}
              >
                <RadioGroupItem
                  value="custom"
                  id="settings-model-custom"
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <span className="font-medium">Custom model</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Enter any model ID supported by your provider
                  </p>
                </div>
              </label>
            </RadioGroup>
            {model === "custom" && (
              <Input
                placeholder="e.g. claude-sonnet-4-5-20250929"
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {saveMsg && (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{saveMsg}</AlertDescription>
            </Alert>
          )}
          {saveError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSaveProvider}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Update & Restart
          </Button>
        </CardContent>
      </Card>

      {/* SOUL.md Editor */}
      <SoulEditorCard />

      {/* Pipeline Stages */}
      <PipelineStagesCard />

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Channels</CardTitle>
          <CardDescription>
            Manage messaging connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-input p-3">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <div className="text-sm font-medium">Telegram</div>
            </div>
            <Badge variant={hasTelegram ? "default" : "secondary"}>
              {hasTelegram ? "Connected" : "Not connected"}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-telegram">
              {hasTelegram ? "Update" : "Add"} Telegram Bot Token
            </Label>
            <div className="flex gap-2">
              <Input
                id="settings-telegram"
                type="password"
                placeholder="Bot token from @BotFather"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleSaveChannel}
                disabled={savingChannel || !telegramToken}
                className="shrink-0"
              >
                {savingChannel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>

          {channelMsg && (
            <Alert variant="success">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{channelMsg}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Google Workspace */}
      <GoogleWorkspaceCard />

      {/* Agent Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agent Status</CardTitle>
          <CardDescription>
            Control the OpenClaw daemon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${daemon.running ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm font-medium">
              {daemon.running ? "Running" : "Stopped"}
            </span>
            {daemon.pid && (
              <span className="text-xs text-muted-foreground">
                PID: {daemon.pid}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {daemon.running ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDaemonAction("restart")}
                  disabled={!!daemonAction}
                  className="gap-2"
                >
                  {daemonAction === "restart" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Restart
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDaemonAction("stop")}
                  disabled={!!daemonAction}
                  className="gap-2"
                >
                  {daemonAction === "stop" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Square className="h-3 w-3" />
                  )}
                  Stop
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDaemonAction("start")}
                disabled={!!daemonAction}
                className="gap-2"
              >
                {daemonAction === "start" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Start
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Configuration */}
      <AdvancedConfigCard />

      {/* Workspace Info */}
      <WorkspaceInfoCard />
    </div>
  );
}
