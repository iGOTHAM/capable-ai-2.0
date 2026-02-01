import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, RefreshCw, Download } from "lucide-react";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project</h1>
          <p className="text-sm text-muted-foreground">ID: {projectId}</p>
        </div>
        <div className="flex gap-2">
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
        </div>
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
          {/* Placeholder — will be populated from DB */}
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-3">
              <Badge>v1</Badge>
              <div>
                <p className="text-sm font-medium">Initial pack</p>
                <p className="text-xs text-muted-foreground">
                  Generated on creation
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
