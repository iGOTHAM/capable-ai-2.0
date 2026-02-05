"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Upload,
  RefreshCw,
  AlertCircle,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface DeploymentManagementCardProps {
  projectId: string;
  activePackVer: number | null;
  latestPackVer: number | null;
  currentMode: "DRAFT_ONLY" | "ASK_FIRST";
  adminSecret: string | null;
  status: string;
}

export function DeploymentManagementCard({
  projectId,
  activePackVer,
  latestPackVer,
  currentMode,
  adminSecret,
  status,
}: DeploymentManagementCardProps) {
  const [pushingPack, setPushingPack] = useState(false);
  const [updatingMode, setUpdatingMode] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"DRAFT_ONLY" | "ASK_FIRST">(currentMode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  const canManage = !!adminSecret && status === "ACTIVE";
  const hasPackUpdate = latestPackVer && activePackVer && latestPackVer > activePackVer;
  const modeChanged = selectedMode !== currentMode;

  const handlePushPack = async () => {
    if (!canManage) return;

    setPushingPack(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/deployments/${projectId}/push-pack`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to push pack");
      }

      const data = await res.json();
      setSuccess(`Pack updated to v${data.version}`);
      setTimeout(() => setSuccess(null), 5000);

      // Refresh the page to show updated version
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to push pack");
    } finally {
      setPushingPack(false);
    }
  };

  const handleUpdateMode = async () => {
    if (!canManage || !modeChanged) return;

    setUpdatingMode(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/deployments/${projectId}/update-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update mode");
      }

      setSuccess(`Mode changed to ${selectedMode === "DRAFT_ONLY" ? "Draft Only" : "Ask First"}`);
      setTimeout(() => setSuccess(null), 5000);

      // Refresh to show updated mode
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update mode");
      // Reset selection on error
      setSelectedMode(currentMode);
    } finally {
      setUpdatingMode(false);
    }
  };

  if (status !== "ACTIVE") {
    return null;
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                Deployment Management
              </CardTitle>
              <CardDescription>
                Update your running deployment without rebuilding
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasPackUpdate && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  Update Available
                </Badge>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {!canManage ? (
              <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-4">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Remote management is not available for this deployment.
                  Redeploy to enable these features.
                </p>
              </div>
            ) : (
              <>
                {/* Pack Version Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Pack Version</h4>
                      <p className="text-xs text-muted-foreground">
                        AI configuration files (SOUL.md, AGENTS.md, etc.)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Current: v{activePackVer ?? "?"}
                        {latestPackVer && ` · Latest: v${latestPackVer}`}
                      </span>
                    </div>
                  </div>

                  {hasPackUpdate ? (
                    <Button
                      size="sm"
                      onClick={handlePushPack}
                      disabled={pushingPack}
                      className="w-full sm:w-auto"
                    >
                      {pushingPack ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Pushing Update...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-3 w-3" />
                          Push Pack Update
                        </>
                      )}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      ✓ Running the latest pack version
                    </p>
                  )}
                </div>

                <div className="border-t" />

                {/* Agent Mode Section */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium">Agent Mode</h4>
                    <p className="text-xs text-muted-foreground">
                      Control how the AI handles external actions
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Select
                      value={selectedMode}
                      onValueChange={(v) => setSelectedMode(v as "DRAFT_ONLY" | "ASK_FIRST")}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT_ONLY">
                          <div className="flex flex-col">
                            <span>Draft Only</span>
                            <span className="text-xs text-muted-foreground">
                              AI drafts actions, you review
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="ASK_FIRST">
                          <div className="flex flex-col">
                            <span>Ask First</span>
                            <span className="text-xs text-muted-foreground">
                              AI asks before external actions
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {modeChanged && (
                      <Button
                        size="sm"
                        onClick={handleUpdateMode}
                        disabled={updatingMode}
                      >
                        {updatingMode ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Applying...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Apply Change
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Success message */}
                {success && (
                  <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                    <Check className="h-4 w-4 shrink-0" />
                    {success}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
