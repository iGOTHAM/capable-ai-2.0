import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, ShieldCheck, Zap } from "lucide-react";

export default function NowPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Now</h1>
        <p className="text-sm text-muted-foreground">
          Current status and activity overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Idle</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Awaiting instructions
            </p>
          </CardContent>
        </Card>

        {/* Current Task */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">
                Current Task
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No active task</p>
          </CardContent>
        </Card>

        {/* Last Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">
                Last Activity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No activity recorded yet
            </p>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">
                Pending Approvals
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">0 pending</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
