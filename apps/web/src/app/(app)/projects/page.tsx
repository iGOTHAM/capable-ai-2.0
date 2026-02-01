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
import { FolderPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const projects = await db.project.findMany({
    where: { userId: user.id },
    include: {
      deployment: true,
      packVersions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your Capable packs and deployments.
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
              <FolderPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <CardTitle className="text-base">No projects yet</CardTitle>
              <CardDescription className="mt-1">
                Create your first project to generate a Capable Pack.
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/projects/new">Create Project</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
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
                      <Badge variant="secondary">{project.mode}</Badge>
                      {project.deployment && (
                        <Badge
                          variant={
                            project.deployment.status === "ACTIVE"
                              ? "default"
                              : "outline"
                          }
                        >
                          {project.deployment.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
