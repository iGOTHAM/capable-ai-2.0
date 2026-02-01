import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { getEventsByRun } from "@/lib/events";

export const dynamic = "force-dynamic";

const typeColors: Record<string, string> = {
  "run.started": "default",
  "run.finished": "default",
  "plan.created": "secondary",
  "tool.called": "outline",
  "tool.result": "outline",
  "approval.requested": "destructive",
  "approval.resolved": "secondary",
  "memory.write": "secondary",
  "security.warning": "destructive",
  error: "destructive",
  "chat.user_message": "outline",
  "chat.bot_message": "outline",
  "bootstrap.completed": "default",
};

export default async function TimelinePage() {
  const runMap = await getEventsByRun();
  const runs = Array.from(runMap.entries()).reverse();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Activity feed grouped by run.
        </p>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <CardTitle className="text-base">No events yet</CardTitle>
              <CardDescription className="mt-1">
                Events will appear here as your assistant works.
              </CardDescription>
            </div>
          </CardContent>
        </Card>
      ) : (
        runs.map(([runId, events]) => (
          <Card key={runId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium font-mono">
                  {runId}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </span>
              </div>
              <CardDescription>
                {new Date(events[0]!.ts).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {events.map((event, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <Badge
                      variant={
                        (typeColors[event.type] as "default" | "secondary" | "destructive" | "outline") ??
                        "outline"
                      }
                      className="mt-0.5 shrink-0 text-[10px]"
                    >
                      {event.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{event.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.ts).toLocaleTimeString()}
                        {event.risk && ` · Risk: ${event.risk}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
