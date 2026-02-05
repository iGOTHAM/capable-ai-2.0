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
import { Input } from "@/components/ui/input";
import {
  Globe,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

interface DashboardAccessCardProps {
  projectId: string;
  subdomain: string | null;
  dropletIp: string | null;
  password: string | null;
  adminSecret: string | null;
  status: string;
}

export function DashboardAccessCard({
  projectId,
  subdomain,
  dropletIp,
  password,
  adminSecret,
  status,
}: DashboardAccessCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<"url" | "password" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(password);
  const [error, setError] = useState<string | null>(null);

  const dashboardUrl = subdomain
    ? `https://${subdomain}.capable.ai`
    : dropletIp
      ? `http://${dropletIp}:3100`
      : null;

  const canRegenerate = !!adminSecret && status === "ACTIVE";

  const copyToClipboard = async (text: string, type: "url" | "password") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const regeneratePassword = async () => {
    if (!canRegenerate) return;

    setRegenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/deployments/${projectId}/regenerate-password`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to regenerate password");
      }

      const { password: newPassword } = await res.json();
      setCurrentPassword(newPassword);
      setShowPassword(true); // Show the new password
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate password");
    } finally {
      setRegenerating(false);
    }
  };

  if (status !== "ACTIVE" || !dashboardUrl) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Dashboard Access
            </CardTitle>
            <CardDescription>
              Login credentials for your deployed dashboard
            </CardDescription>
          </div>
          <Badge variant="default" className="bg-green-600">Live</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dashboard URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Dashboard URL
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono">
              {dashboardUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => copyToClipboard(dashboardUrl, "url")}
            >
              {copied === "url" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              asChild
            >
              <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Password */}
        {currentPassword && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Password
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  readOnly
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => copyToClipboard(currentPassword, "password")}
              >
                {copied === "password" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Regenerate Password */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {canRegenerate
              ? "Generate a new password if you've forgotten or need to revoke access."
              : "Password reset requires a fresh deployment."}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={regeneratePassword}
            disabled={!canRegenerate || regenerating}
          >
            {regenerating ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                Regenerate
              </>
            )}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
