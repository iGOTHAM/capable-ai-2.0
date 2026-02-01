import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderPlus } from "lucide-react";

export default function ProjectsPage() {
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

      {/* Empty state */}
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
    </div>
  );
}
