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
import { Copy, Check, ExternalLink } from "lucide-react";

const PLACEHOLDER_CLOUD_INIT = `#!/bin/bash
# Capable.ai — Cloud-Init Script
# Paste this into your DigitalOcean droplet User Data field

set -euo pipefail

echo ">>> Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo ">>> Creating directories..."
mkdir -p /root/.openclaw/workspace
mkdir -p /data/activity

echo ">>> Downloading Capable Pack..."
# PACK_URL will be replaced with a real signed URL
curl -fsSL "PACK_URL_PLACEHOLDER" -o /tmp/pack.zip
cd /root/.openclaw/workspace && unzip -o /tmp/pack.zip

echo ">>> Starting dashboard..."
# Dashboard will start on port 3100
docker run -d \\
  --name capable-dashboard \\
  --restart unless-stopped \\
  -p 3100:3100 \\
  -v /data/activity:/data/activity \\
  -v /root/.openclaw/workspace:/workspace \\
  -e AUTH_PASSWORD="CHANGE_ME" \\
  capable-ai/dashboard:latest

echo ">>> Sending heartbeat..."
curl -X POST https://capable.ai/api/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":"PROJECT_ID","packVersion":1,"status":"active"}'

echo ">>> Done! Dashboard available at http://$(curl -s ifconfig.me):3100"`;

export default function DeployPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(PLACEHOLDER_CLOUD_INIT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Deploy</h1>
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
              href="https://m.do.co/c/REFERRAL"
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
              {PLACEHOLDER_CLOUD_INIT}
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
          <div className="flex items-center gap-2">
            <Badge variant="outline">Step 3</Badge>
            <CardTitle className="text-base">Deployment Status</CardTitle>
          </div>
          <CardDescription>
            We&apos;ll detect when your droplet sends its first heartbeat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-yellow-500" />
            <span className="text-sm font-medium">Waiting for heartbeat...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
