import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function TimelinePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Activity feed grouped by run, filterable by type.
        </p>
      </div>

      {/* Empty state */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <CardTitle className="text-base">No events yet</CardTitle>
            <CardDescription className="mt-1">
              Events will appear here as your assistant works. Each run is
              grouped with expandable details.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
