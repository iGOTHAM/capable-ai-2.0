import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Clock,
  CheckSquare,
  Loader2,
  ArrowRight,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { getLatestEvents, getPendingApprovals } from "@/lib/events";
import { readTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const [events, pendingApprovals, tasksData] = await Promise.all([
    getLatestEvents(10),
    getPendingApprovals(),
    readTasks(),
  ]);

  const activeRun = events.find(
    (e) =>
      e.type === "run.started" &&
      !events.some((f) => f.type === "run.finished" && f.runId === e.runId),
  );

  // Task stats
  const allTasks = [...tasksData.tasks, ...tasksData.completed];
  const stats = {
    pending: allTasks.filter((t) => t.status === "pending").length,
    inProgress: allTasks.filter((t) => t.status === "in-progress").length,
    done: allTasks.filter((t) => t.status === "done").length,
  };

  // Recent tasks (top 5 by priority)
  const recentTasks = tasksData.tasks
    .filter((t) => t.status !== "archived")
    .sort((a, b) => {
      const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Agent Status — prominent */}
      <Card className="border-primary/20">
        <CardContent className="flex items-center gap-4 p-6">
          <div
            className={`h-4 w-4 rounded-full shrink-0 ${activeRun ? "bg-blue-500 animate-pulse" : "bg-green-500"
              }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold">
              {activeRun ? "Working" : "Idle"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {activeRun
                ? activeRun.summary
                : "Awaiting instructions — send a message via your connected channel"}
            </p>
          </div>
          {pendingApprovals.length > 0 && (
            <Link href="/approvals">
              <Badge variant="destructive" className="shrink-0">
                {pendingApprovals.length} approval
                {pendingApprovals.length !== 1 ? "s" : ""} pending
              </Badge>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-blue-500/10 p-2">
              <CheckSquare className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">To Do</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-orange-500/10 p-2">
              <Loader2 className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-green-500/10 p-2">
              <Activity className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.done}</p>
              <p className="text-xs text-muted-foreground">Done</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Recent Tasks
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 gap-1">
                <Link href="/tasks">
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No tasks yet. Add one from the Tasks page.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${task.status === "in-progress"
                          ? "bg-orange-500"
                          : task.status === "done"
                            ? "bg-green-500"
                            : "bg-blue-500"
                        }`}
                    />
                    <span className="truncate flex-1">{task.title}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 shrink-0 ${task.priority === "high"
                          ? "text-red-500"
                          : task.priority === "medium"
                            ? "text-orange-500"
                            : "text-gray-500"
                        }`}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Recent Activity
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-7 gap-1">
                <Link href="/timeline">
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {events.slice(0, 8).map((event, i) => (
                  <div
                    key={`${event.ts}-${i}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{event.summary}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(event.ts)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Settings Link */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Agent Settings</p>
              <p className="text-xs text-muted-foreground">
                Change model, connect Slack/Telegram, configure channels
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/open-chat">Open Settings</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
