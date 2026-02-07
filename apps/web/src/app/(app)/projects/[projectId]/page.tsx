import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  Rocket,
  Bot,
  FileText,
  Shield,
  Monitor,
  Globe,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RegenerateButton } from "@/components/regenerate-button";
import { PackDownloadButton } from "@/components/pack-download-button";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { PackFilesViewer } from "@/components/pack-files-viewer";
import { DashboardAccessCard } from "@/components/dashboard-access-card";
import { DeploymentManagementCard } from "@/components/deployment-management-card";
import { EditableProjectDetails } from "@/components/editable-project-details";
import { getActiveSubscription, getSubscription } from "@/lib/subscription-guard";
import { templateLabel } from "@/lib/labels";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ subscription?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;
  const { subscription: subParam } = await searchParams;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      packVersions: { orderBy: { version: "desc" } },
      deployment: true,
    },
  });

  if (!project) notFound();

  // Check subscription status
  const activeSub = await getActiveSubscription(user.id);
  const anySub = !activeSub ? await getSubscription(user.id) : activeSub;
  const isCanceled = anySub?.status === "CANCELED";
  const hasActiveSub = !!activeSub;

  // Determine dashboard URL
  const dashboardUrl = project.deployment?.subdomain
    ? `https://${project.deployment.subdomain}.capable.ai`
    : project.deployment?.dropletIp
      ? `http://${project.deployment.dropletIp}:3100`
      : null;

  // Extract heartbeat data for dashboard access
  const heartbeatData = project.deployment?.heartbeatData as {
    dashboardPassword?: string;
    adminSecret?: string;
  } | null;

  return (
    <div className="flex flex-col gap-6">
      {/* Subscription success banner */}
      {subParam === "success" && (
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <Bot className="h-4 w-4 shrink-0" />
          Subscription activated! Your project is ready to deploy.
        </div>
      )}

      {/* Canceled subscription banner */}
      {isCanceled && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Your subscription has been canceled. Deployments are deactivated.{" "}
          <Link href="/settings" className="underline hover:no-underline">
            Re-subscribe
          </Link>{" "}
          to restore access.
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {project.botName || project.name}
            </h1>
            {project.deployment?.subdomain && (
              <Badge variant="secondary" className="text-xs">
                {project.deployment.subdomain}.capable.ai
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {project.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasActiveSub && (
            <>
              <RegenerateButton projectId={projectId} />
              {project.deployment?.status === "ACTIVE" ? (
                <Button variant="outline" asChild>
                  <Link href={`/projects/${projectId}/deploy`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage
                  </Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href={`/projects/${projectId}/deploy`}>
                    <Rocket className="mr-2 h-4 w-4" />
                    Deploy
                  </Link>
                </Button>
              )}
            </>
          )}
          {!hasActiveSub && !isCanceled && (
            <Button asChild>
              <Link href="/settings">Subscribe to Deploy</Link>
            </Button>
          )}
          <DeleteProjectButton
            projectId={projectId}
            projectName={project.botName || project.name}
          />
        </div>
      </div>

      {/* What you get section */}
      {project.packVersions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">What&apos;s in your Capable Pack</CardTitle>
            <CardDescription>
              Your pack contains everything needed to run an AI assistant on your own server.
              Deploy it to a DigitalOcean droplet and interact with your agent through the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">AI Persona &amp; Rules</p>
                  <p className="text-xs text-muted-foreground">
                    Custom personality, operating boundaries, and safety rules tailored to your workflow
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">Knowledge &amp; Memory</p>
                  <p className="text-xs text-muted-foreground">
                    Domain-specific knowledge files and structured memory that persists across sessions
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">Dashboard</p>
                  <p className="text-xs text-muted-foreground">
                    A web interface on your server to see what your agent is doing, approve actions, and chat
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">You Own Everything</p>
                  <p className="text-xs text-muted-foreground">
                    Runs on your server, uses your API keys. We never access your data or credentials
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pack Contents */}
      {project.packVersions.length > 0 && (() => {
        const latestFiles = project.packVersions[0]?.files as Record<string, string> | undefined;
        if (!latestFiles || Object.keys(latestFiles).length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pack Contents</CardTitle>
              <CardDescription>
                The files that power your AI agent. These are deployed to your server.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PackFilesViewer files={latestFiles} />
            </CardContent>
          </Card>
        );
      })()}

      {/* Project Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Template</CardDescription>
            <CardTitle className="text-base">
              {templateLabel(project.templateId)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-base">
              {project.deployment?.status === "ACTIVE" ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">Live</Badge>
                  {dashboardUrl && (
                    <a
                      href={dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Globe className="h-3 w-3" />
                      Open
                    </a>
                  )}
                </div>
              ) : project.deployment?.status === "PROVISIONING" ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="animate-pulse">
                    Provisioning...
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ~3-5 min
                  </span>
                </div>
              ) : project.deployment?.status === "PENDING" ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="animate-pulse">
                    Setting up...
                  </Badge>
                </div>
              ) : (
                <Badge variant="outline">
                  {project.deployment?.status === "DEACTIVATED"
                    ? "Deactivated"
                    : project.deployment?.status === "UNHEALTHY"
                      ? "Unhealthy"
                      : "Ready to deploy"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Dashboard Access — shown when deployed */}
      {project.deployment?.status === "ACTIVE" && (
        <DashboardAccessCard
          projectId={projectId}
          subdomain={project.deployment.subdomain}
          dropletIp={project.deployment.dropletIp}
          password={heartbeatData?.dashboardPassword ?? null}
          adminSecret={heartbeatData?.adminSecret ?? null}
          status={project.deployment.status}
        />
      )}

      {/* Deployment Management — shown when deployed and admin secret available */}
      {project.deployment?.status === "ACTIVE" && (
        <DeploymentManagementCard
          projectId={projectId}
          activePackVer={project.deployment.activePackVer}
          latestPackVer={project.packVersions[0]?.version ?? null}
          adminSecret={heartbeatData?.adminSecret ?? null}
          status={project.deployment.status}
        />
      )}

      {/* Editable project details */}
      <EditableProjectDetails
        project={{
          id: projectId,
          description: project.description,
          personality: project.personality,
          userName: project.userName,
          userRole: project.userRole,
          neverRules: project.neverRules,
          templateId: project.templateId,
          businessContext: project.businessContext as Record<string, string> | null,
        }}
      />

      {/* Next Steps — shown before deployment */}
      {hasActiveSub && (!project.deployment || project.deployment.status === "PENDING") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Steps</CardTitle>
            <CardDescription>
              Your pack is ready. Here&apos;s how to get your AI agent running:
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">1</Badge>
              <div>
                <p className="text-sm font-medium">Deploy to your server</p>
                <p className="text-xs text-muted-foreground">
                  Click Deploy above to get a setup script for your DigitalOcean droplet. It takes about 5 minutes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">2</Badge>
              <div>
                <p className="text-sm font-medium">Open your dashboard</p>
                <p className="text-xs text-muted-foreground">
                  {project.deployment?.subdomain
                    ? `Once deployed, your dashboard will be at https://${project.deployment.subdomain}.capable.ai`
                    : "Once deployed, you'll get a URL and password to access your private dashboard on your server."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">3</Badge>
              <div>
                <p className="text-sm font-medium">Start working with your agent</p>
                <p className="text-xs text-muted-foreground">
                  Use the dashboard to chat with your agent, review its work on the timeline, and approve actions in real time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pack Versions */}
      <Card>
        <CardHeader>
          <CardTitle>Pack Versions</CardTitle>
          <CardDescription>
            Each version contains your agent&apos;s persona, rules, knowledge, and memory configuration.
            Regenerate to update your pack with the latest settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project.packVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pack versions yet. Your pack will be generated when you create the project.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {project.packVersions.map((pv) => (
                <div
                  key={pv.id}
                  className="flex items-center justify-between rounded-md border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Badge>v{pv.version}</Badge>
                    <div>
                      <p className="text-sm font-medium">
                        {pv.changelog || "Pack version " + pv.version}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pv.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <PackDownloadButton
                    projectId={projectId}
                    version={pv.version}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
