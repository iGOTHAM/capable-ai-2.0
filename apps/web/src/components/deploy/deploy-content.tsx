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
import { Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import { generateCloudInitScript } from "@/lib/cloud-init";

interface DeployContentProps {
  projectId: string;
  projectName: string;
  projectToken: string;
  deploymentStatus: string;
  lastHeartbeat: string | null;
  dropletIp: string | null;
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
  });

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
        <p className="text-sm text-muted-foreground">
          Deploy your Capable Pack to a DigitalOcean droplet.
        </p>
      </div>

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
            Create a new droplet with Ubuntu 22.04, minimum 2 GB RAM.
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
              Paste Cloud-Init Script
            </CardTitle>
          </div>
          <CardDescription>
            Copy this script and paste it into the &quot;User Data&quot; field
            when creating your droplet.
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
              <CardTitle className="text-base">Deployment Status</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={refreshStatus}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Refresh
            </Button>
          </div>
          <CardDescription>
            We&apos;ll detect when your droplet sends its first heartbeat.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${s.color} ${s.animate ? "animate-pulse" : ""}`}
            />
            <span className="text-sm font-medium">{s.label}</span>
            {status === "ACTIVE" && ip && (
              <a
                href={`http://${ip}:3100`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                http://{ip}:3100
              </a>
            )}
          </div>
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
