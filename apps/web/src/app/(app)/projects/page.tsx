import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderPlus, Bot } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/subscription-guard";
import { templateLabel, modeLabel } from "@/lib/labels";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Live",
  PENDING: "Ready to deploy",
  PROVISIONING: "Provisioning",
  UNHEALTHY: "Unhealthy",
  DEACTIVATED: "Deactivated",
};

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [projects, subscription] = await Promise.all([
    db.project.findMany({
      where: { userId: user.id },
      include: {
        deployment: true,
        packVersions: { orderBy: { version: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    getActiveSubscription(user.id),
  ]);

  const hasSubscription = !!subscription;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your AI Agents</h1>
          <p className="text-sm text-muted-foreground">
            Each project is a self-hosted AI agent you own and control.
            Create a project, deploy it to your server, and interact through your private dashboard.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <FolderPlus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bot className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <CardTitle className="text-base">No agents yet</CardTitle>
              <CardDescription className="mt-1 max-w-sm">
                Create your first project to build a Capable Pack — a complete AI agent
                with persona, knowledge, and memory that runs on your own server.
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/projects/new">Create Your First Agent</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const deployStatus = project.deployment?.status;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {templateLabel(project.templateId)}
                        </Badge>
                        <Badge variant="secondary">
                          {modeLabel(project.mode)}
                        </Badge>
                        <Badge
                          variant={
                            deployStatus === "ACTIVE" ? "default" : "outline"
                          }
                        >
                          {deployStatus
                            ? (STATUS_LABELS[deployStatus] ?? deployStatus)
                            : hasSubscription
                              ? "Ready to deploy"
                              : "Subscribe to deploy"}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
