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
  Pencil,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface DashboardAccessCardProps {
  projectId: string;
  subdomain: string | null;
  dropletIp: string | null;
  password: string | null;
  hasAdminSecret: boolean;
  status: string;
}

export function DashboardAccessCard({
  projectId,
  subdomain,
  dropletIp,
  password,
  hasAdminSecret,
  status,
}: DashboardAccessCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<"url" | "password" | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(password);
  const [editMode, setEditMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dashboardUrl = subdomain
    ? `https://${subdomain}.capable.ai`
    : dropletIp
      ? `http://${dropletIp}:3100`
      : null;

  const canChangePassword = hasAdminSecret && status === "ACTIVE";

  const copyToClipboard = async (text: string, type: "url" | "password") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSavePassword = async () => {
    if (!canChangePassword || !newPassword.trim()) return;

    // Validate password
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/deployments/${projectId}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update password");
      }

      setCurrentPassword(newPassword);
      setNewPassword("");
      setEditMode(false);
      setShowPassword(true);
      setSuccess("Password updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setNewPassword("");
    setError(null);
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

        {/* Password - View Mode */}
        {!editMode && currentPassword && (
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
              {canChangePassword && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setEditMode(true)}
                  title="Change password"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Password - Edit Mode */}
        {editMode && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground">
              New Password
            </label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter your new password"
              className="font-mono text-sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Choose something easy to type on mobile. Minimum 8 characters.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSavePassword}
                disabled={saving || !newPassword.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Password"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Help text for legacy deployments */}
        {!canChangePassword && currentPassword && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              To change your password, redeploy your dashboard from the Manage page.
            </p>
          </div>
        )}

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
      </CardContent>
    </Card>
  );
}
