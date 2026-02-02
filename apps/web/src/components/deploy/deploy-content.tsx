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
import { Copy, Check, ExternalLink, RefreshCw, Globe } from "lucide-react";
import { generateCloudInitScript } from "@/lib/cloud-init";

interface DeployContentProps {
  projectId: string;
  projectName: string;
  projectToken: string;
  deploymentStatus: string;
  lastHeartbeat: string | null;
  dropletIp: string | null;
  subdomain: string | null;
  doReferralUrl: string;
  appUrl: string;
  latestPackVersion: number;
}

const statusConfig: Record<
  string,
  { color: string; label: string; animate: boolean }
> = {
  PENDING: { color: "bg-yellow-500", label: "Waiting for heartbeat...", animate: true },
  PROVISIONING: { color: "bg-blue-500", label: "Provisioning...", animate: true },
  ACTIVE: { color: "bg-green-500", label: "Live", animate: false },
  UNHEALTHY: { color: "bg-red-500", label: "Unhealthy", animate: true },
  DEACTIVATED: { color: "bg-zinc-500", label: "Deactivated", animate: false },
};

export function DeployContent(props: DeployContentProps) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(props.deploymentStatus);
  const [lastHb, setLastHb] = useState(props.lastHeartbeat);
  const [ip, setIp] = useState(props.dropletIp);

  const cloudInit = generateCloudInitScript({
    appUrl: props.appUrl,
    projectId: props.projectId,
    projectToken: props.projectToken,
    packVersion: props.latestPackVersion,
    subdomain: props.subdomain ?? undefined,
  });

  // Determine the dashboard URL — prefer subdomain, fallback to raw IP
  const dashboardUrl = props.subdomain
    ? `https://${props.subdomain}.capable.ai`
    : ip
      ? `http://${ip}:3100`
      : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cloudInit);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshStatus = async () => {
    const res = await fetch(
      `/api/deployments/${props.projectId}/status`,
    );
    if (res.ok) {
      const data = await res.json();
      setStatus(data.status);
      setLastHb(data.lastHeartbeatAt);
      setIp(data.dropletIp);
    }
  };

  const s = statusConfig[status] ?? { color: "bg-yellow-500", label: "Waiting for heartbeat...", animate: true };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Deploy: {props.projectName}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Your Capable Pack is ready to go. Follow the steps below to deploy it to a
          DigitalOcean droplet. Once live, you&apos;ll access your AI agent through a private
          dashboard on your server — chat with it, review its work on a timeline, and approve
          actions in real time.
        </p>
      </div>

      {/* Subdomain preview */}
      {props.subdomain && (
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
          <Globe className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm">
            Your dashboard will be available at{" "}
            <strong className="text-primary">
              https://{props.subdomain}.capable.ai
            </strong>
          </span>
        </div>
      )}

      {/* Step 1: Create Droplet */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Step 1</Badge>
            <CardTitle className="text-base">
              Create a DigitalOcean Droplet
            </CardTitle>
          </div>
          <CardDescription>
            Create a new droplet with <strong>Ubuntu 22.04</strong> and at least <strong>2 GB RAM</strong>.
            This will be your agent&apos;s home — it runs entirely on your server, using your API keys.
            We never access your data or credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a
              href={props.doReferralUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open DigitalOcean
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Cloud Init */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Step 2</Badge>
            <CardTitle className="text-base">
              Paste the Setup Script
            </CardTitle>
          </div>
          <CardDescription>
            When creating your droplet, scroll down to <strong>&quot;Advanced Options&quot;</strong> and
            check <strong>&quot;Add Initialization Scripts (free)&quot;</strong>. Paste the script below
            into the text field. It installs your Capable Pack{props.subdomain ? ", sets up HTTPS," : ""} and starts your
            private dashboard — the whole process takes about 5 minutes after the droplet boots.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
              {cloudInit}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute right-2 top-2"
              onClick={handleCopy}
              aria-label={copied ? "Copied to clipboard" : "Copy cloud-init script"}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Step 3</Badge>
              <CardTitle className="text-base">Wait for Your Agent to Come Online</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={refreshStatus}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Once the droplet finishes setup, it will send a heartbeat to confirm it&apos;s running.
            When the status turns green, click the link below to open your private dashboard.
            From there you can chat with your agent, see what it&apos;s working on, and approve any actions it wants to take.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${s.color} ${s.animate ? "animate-pulse" : ""}`}
            />
            <span className="text-sm font-medium">{s.label}</span>
            {status === "ACTIVE" && dashboardUrl && (
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Open Dashboard →
              </a>
            )}
          </div>
          {status === "ACTIVE" && dashboardUrl && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">
                Your dashboard is running at{" "}
                <strong>{dashboardUrl}</strong>.
                Log in with the password from your server&apos;s credentials file.
              </p>
              {/* If using subdomain, show raw IP as fallback */}
              {props.subdomain && ip && (
                <p className="text-xs text-muted-foreground">
                  Direct IP fallback: http://{ip}:3100
                </p>
              )}
            </div>
          )}
          {lastHb && (
            <p className="text-xs text-muted-foreground">
              Last heartbeat: {new Date(lastHb).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
