"use client";

import { useState, useTransition } from "react";
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
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Globe,
  Cloud,
  ChevronDown,
  ChevronRight,
  Trash2,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { generateCloudInitScript } from "@/lib/cloud-init";
import {
  deployDroplet,
  destroyDeployment,
  rebuildDeployment,
} from "@/lib/deploy-actions";

interface DeployContentProps {
  projectId: string;
  projectName: string;
  projectToken: string;
  deploymentStatus: string;
  lastHeartbeat: string | null;
  dropletIp: string | null;
  subdomain: string | null;
  deployMethod: string | null;
  dropletRegion: string | null;
  dropletSize: string | null;
  doConnected: boolean;
  doEmail: string | null;
  doReferralUrl: string;
  appUrl: string;
  latestPackVersion: number;
}

const statusConfig: Record<
  string,
  { color: string; label: string; animate: boolean }
> = {
  PENDING: {
    color: "bg-yellow-500",
    label: "Waiting for heartbeat...",
    animate: true,
  },
  PROVISIONING: {
    color: "bg-blue-500",
    label: "Provisioning droplet...",
    animate: true,
  },
  ACTIVE: { color: "bg-green-500", label: "Live", animate: false },
  UNHEALTHY: { color: "bg-red-500", label: "Unhealthy", animate: true },
  DEACTIVATED: { color: "bg-zinc-500", label: "Deactivated", animate: false },
};

const REGIONS = [
  { slug: "nyc1", name: "New York 1" },
  { slug: "nyc3", name: "New York 3" },
  { slug: "sfo3", name: "San Francisco 3" },
  { slug: "ams3", name: "Amsterdam 3" },
  { slug: "sgp1", name: "Singapore 1" },
  { slug: "lon1", name: "London 1" },
  { slug: "fra1", name: "Frankfurt 1" },
  { slug: "tor1", name: "Toronto 1" },
  { slug: "blr1", name: "Bangalore 1" },
  { slug: "syd1", name: "Sydney 1" },
];

const SIZES = [
  {
    slug: "s-1vcpu-1gb",
    label: "$6/mo — 1 GB RAM, 1 vCPU",
    description: "Good for testing and light usage",
  },
  {
    slug: "s-1vcpu-2gb",
    label: "$12/mo — 2 GB RAM, 1 vCPU",
    description: "Recommended for most users",
  },
  {
    slug: "s-2vcpu-4gb",
    label: "$24/mo — 4 GB RAM, 2 vCPU",
    description: "For heavy usage or local models",
  },
];

export function DeployContent(props: DeployContentProps) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(props.deploymentStatus);
  const [lastHb, setLastHb] = useState(props.lastHeartbeat);
  const [ip, setIp] = useState(props.dropletIp);
  const [showManual, setShowManual] = useState(false);
  const [region, setRegion] = useState("nyc1");
  const [size, setSize] = useState("s-1vcpu-1gb");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDeployed =
    status === "ACTIVE" ||
    status === "PROVISIONING" ||
    status === "UNHEALTHY";
  const isAutoDeployed = props.deployMethod === "auto";

  const cloudInit = generateCloudInitScript({
    appUrl: props.appUrl,
    projectId: props.projectId,
    projectToken: props.projectToken,
    packVersion: props.latestPackVersion,
    subdomain: props.subdomain ?? undefined,
  });

  // IPv6 addresses need brackets in URLs (e.g. http://[::1]:3100)
  const ipForUrl = ip?.includes(":") ? `[${ip}]` : ip;

  const dashboardUrl = props.subdomain
    ? `https://${props.subdomain}.capable.ai`
    : ip
      ? `http://${ipForUrl}:3100`
      : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cloudInit);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshStatus = async () => {
    const res = await fetch(`/api/deployments/${props.projectId}/status`);
    if (res.ok) {
      const data = await res.json();
      setStatus(data.status);
      setLastHb(data.lastHeartbeatAt);
      setIp(data.dropletIp);
    }
  };

  const handleDeploy = () => {
    setError(null);
    startTransition(async () => {
      const result = await deployDroplet(props.projectId, region, size);
      if (result.error) {
        setError(result.error);
      } else {
        setStatus("PROVISIONING");
      }
    });
  };

  const handleDestroy = () => {
    setError(null);
    startTransition(async () => {
      const result = await destroyDeployment(props.projectId);
      if (result.error) {
        setError(result.error);
      } else {
        setStatus("DEACTIVATED");
        setIp(null);
      }
    });
  };

  const handleRebuild = () => {
    setError(null);
    startTransition(async () => {
      const result = await rebuildDeployment(props.projectId, region, size);
      if (result.error) {
        setError(result.error);
      } else {
        setStatus("PROVISIONING");
      }
    });
  };

  const s = statusConfig[status] ?? statusConfig.PENDING!;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Deploy: {props.projectName}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Deploy your Capable Pack to a DigitalOcean droplet. Once live,
          you&apos;ll access your AI agent through a private dashboard.
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

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* One-Click Deploy */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">One-Click Deploy</CardTitle>
          </div>
          <CardDescription>
            Connect your DigitalOcean account and deploy with a single click.
            Your server, your data — we just set it up for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!props.doConnected ? (
            /* Not connected — show connect button */
            <div className="flex flex-col gap-3">
              <Button asChild>
                <a
                  href={`/api/auth/digitalocean?projectId=${props.projectId}`}
                >
                  Connect DigitalOcean
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Don&apos;t have an account?{" "}
                <a
                  href={props.doReferralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Sign up for $200 in free credits
                </a>
              </p>
            </div>
          ) : !isDeployed ? (
            /* Connected but not deployed — show region/size + deploy */
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-500" />
                Connected as{" "}
                <span className="font-medium text-foreground">
                  {props.doEmail}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="region"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Region
                  </label>
                  <select
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {REGIONS.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="size"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Size
                  </label>
                  <select
                    id="size"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {SIZES.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {SIZES.find((s) => s.slug === size)?.description}
                  </p>
                </div>
              </div>

              <Button onClick={handleDeploy} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating droplet...
                  </>
                ) : (
                  "Deploy Now"
                )}
              </Button>
            </div>
          ) : (
            /* Deployed — show status */
            <div className="flex flex-col gap-3">
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
                    Dashboard running at <strong>{dashboardUrl}</strong>.
                  </p>
                  {props.subdomain && ip && (
                    <p className="text-xs text-muted-foreground">
                      Direct IP fallback: http://{ipForUrl}:3100
                    </p>
                  )}
                </div>
              )}
              {lastHb && (
                <p className="text-xs text-muted-foreground">
                  Last heartbeat: {new Date(lastHb).toLocaleString()}
                </p>
              )}
              {status !== "ACTIVE" && (
                <Button variant="outline" size="sm" onClick={refreshStatus}>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Check Status
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Droplet Management — only for auto-deployed */}
      {isAutoDeployed && isDeployed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Droplet Management</CardTitle>
            <CardDescription>
              {props.dropletRegion && props.dropletSize && (
                <span>
                  Region: {props.dropletRegion} · Size: {props.dropletSize}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRebuild}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 h-3 w-3" />
              )}
              Rebuild
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDestroy}
              disabled={isPending}
              className="text-red-600 hover:text-red-700"
            >
              {isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3 w-3" />
              )}
              Destroy
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manual Deploy Fallback */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowManual(!showManual)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {showManual ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Deploy manually instead
        </button>

        {showManual && (
          <div className="mt-4 flex flex-col gap-6">
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
                  Create a new droplet with <strong>Ubuntu 22.04</strong> and
                  at least <strong>1 GB RAM</strong>.
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
                  Under <strong>&quot;Advanced Options&quot;</strong>, check{" "}
                  <strong>
                    &quot;Add Initialization Scripts (free)&quot;
                  </strong>{" "}
                  and paste the script below.
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
                    <CardTitle className="text-base">
                      Wait for Your Agent to Come Online
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" onClick={refreshStatus}>
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Refresh
                  </Button>
                </div>
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
                {lastHb && (
                  <p className="text-xs text-muted-foreground">
                    Last heartbeat: {new Date(lastHb).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
