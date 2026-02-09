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

const typeBorderColors: Record<string, string> = {
  "run.started": "border-l-blue-500",
  "run.finished": "border-l-green-500",
  "plan.created": "border-l-violet-500",
  "tool.called": "border-l-zinc-400",
  "tool.result": "border-l-zinc-400",
  "approval.requested": "border-l-amber-500",
  "approval.resolved": "border-l-green-500",
  "memory.write": "border-l-cyan-500",
  "security.warning": "border-l-red-500",
  error: "border-l-red-500",
  "chat.user_message": "border-l-zinc-300",
  "chat.bot_message": "border-l-zinc-300",
  "bootstrap.completed": "border-l-emerald-500",
};

export default async function TimelinePage() {
  const runMap = await getEventsByRun();
  const runs = Array.from(runMap.entries()).reverse();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Agent activity feed grouped by run. Shows tool calls, plans, approvals, and chat messages.
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
        runs.map(([runId, events]) => {
          const startEvent = events.find((e) => e.type === "run.started");
          const endEvent = events.find((e) => e.type === "run.finished");
          const isActive = startEvent && !endEvent;

          return (
            <Card key={runId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                    <CardTitle className="text-sm font-medium font-mono">
                      {runId}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {events.length} event{events.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <CardDescription>
                  {new Date(events[0]!.ts).toLocaleString()}
                  {endEvent && (
                    <span className="ml-2">
                      — {new Date(endEvent.ts).toLocaleString()}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative flex flex-col gap-0">
                  {events.map((event, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 border-l-2 p-3 pl-4 ${
                        typeBorderColors[event.type] ?? "border-l-zinc-300"
                      } ${i < events.length - 1 ? "" : ""}`}
                    >
                      <Badge
                        variant={
                          (typeColors[event.type] as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline") ?? "outline"
                        }
                        className="mt-0.5 shrink-0 text-[10px]"
                      >
                        {event.type}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{event.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.ts).toLocaleTimeString()}
                          {event.risk && (
                            <Badge
                              variant="destructive"
                              className="ml-2 text-[9px] px-1.5 py-0"
                            >
                              {event.risk}
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
