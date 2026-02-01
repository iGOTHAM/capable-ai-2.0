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
import { Rocket, RefreshCw, Download, CreditCard } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      packVersions: { orderBy: { version: "desc" } },
      deployment: true,
      payments: { where: { status: "COMPLETED" }, take: 1 },
    },
  });

  if (!project) notFound();

  const isPaid = project.payments.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.description}
          </p>
        </div>
        <div className="flex gap-2">
          {isPaid ? (
            <>
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate Pack
              </Button>
              <Button asChild>
                <Link href={`/projects/${projectId}/deploy`}>
                  <Rocket className="mr-2 h-4 w-4" />
                  Deploy
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link href={`/projects/${projectId}/checkout`}>
                <CreditCard className="mr-2 h-4 w-4" />
                Complete Payment
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Project Info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Template</CardDescription>
            <CardTitle className="text-base capitalize">
              {project.templateId}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mode</CardDescription>
            <CardTitle className="text-base">
              <Badge variant="secondary">{project.mode}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-base">
              <Badge
                variant={
                  project.deployment?.status === "ACTIVE"
                    ? "default"
                    : "outline"
                }
              >
                {project.deployment?.status ?? (isPaid ? "Ready" : "Unpaid")}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Pack Versions */}
      <Card>
        <CardHeader>
          <CardTitle>Pack Versions</CardTitle>
          <CardDescription>
            History of generated packs for this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project.packVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isPaid
                ? "Pack generation in progress..."
                : "Complete payment to generate your first pack."}
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
                  <Button variant="ghost" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
