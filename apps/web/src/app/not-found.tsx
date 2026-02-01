import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <CardTitle className="text-base">Page not found</CardTitle>
            <CardDescription className="mt-1">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/projects">Go to Projects</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
