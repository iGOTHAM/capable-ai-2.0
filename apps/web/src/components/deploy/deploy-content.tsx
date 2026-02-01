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

function generateCloudInit(props: {
  appUrl: string;
  projectId: string;
  projectToken: string;
  packVersion: number;
}): string {
  return `#!/bin/bash
# Capable.ai — Cloud-Init Script
# Paste this into your DigitalOcean droplet User Data field

set -euo pipefail

echo ">>> Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo ">>> Installing unzip..."
apt-get install -y unzip

echo ">>> Creating directories..."
mkdir -p /root/.openclaw/workspace
mkdir -p /data/activity

echo ">>> Downloading Capable Pack..."
PACK_URL=$(curl -sf -X POST ${props.appUrl}/api/packs/${props.projectId}/download-url \\
  -H "Content-Type: application/json" \\
  -d '{"version":${props.packVersion}}' | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")

curl -fsSL "$PACK_URL" -o /tmp/pack.zip
cd /root/.openclaw/workspace && unzip -o /tmp/pack.zip

echo ">>> Generating dashboard password..."
DASH_PASSWORD=$(openssl rand -base64 16)
echo "Dashboard password: $DASH_PASSWORD" > /root/dashboard-credentials.txt
chmod 600 /root/dashboard-credentials.txt

echo ">>> Starting dashboard..."
docker run -d \\
  --name capable-dashboard \\
  --restart unless-stopped \\
  -p 3100:3100 \\
  -v /data/activity:/data/activity \\
  -v /root/.openclaw/workspace:/workspace \\
  -e AUTH_PASSWORD="$DASH_PASSWORD" \\
  capable-ai/dashboard:latest

echo ">>> Setting up heartbeat cron..."
DROPLET_IP=$(curl -s ifconfig.me)
cat > /etc/cron.d/capable-heartbeat << CRON
*/5 * * * * root curl -sf -X POST ${props.appUrl}/api/deployments/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"projectToken":"${props.projectToken}","dropletIp":"'\\$DROPLET_IP'","packVersion":${props.packVersion},"status":"active"}' > /dev/null 2>&1
CRON

echo ">>> Sending initial heartbeat..."
curl -sf -X POST ${props.appUrl}/api/deployments/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"projectToken":"${props.projectToken}","dropletIp":"'$DROPLET_IP'","packVersion":${props.packVersion},"status":"active"}'

echo ""
echo "========================================="
echo "  Capable.ai deployment complete!"
echo "  Dashboard: http://$DROPLET_IP:3100"
echo "  Password:  $DASH_PASSWORD"
echo "  (also saved to /root/dashboard-credentials.txt)"
echo "========================================="`;
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

  const cloudInit = generateCloudInit({
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
