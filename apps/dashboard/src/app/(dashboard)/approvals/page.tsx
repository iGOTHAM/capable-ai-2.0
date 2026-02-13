import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { getPendingApprovals } from "@/lib/events";
import { ApprovalActions } from "@/components/approval-actions";

export const dynamic = "force-dynamic";

const riskColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
  critical: "destructive",
};

export default async function ApprovalsPage() {
  const approvals = await getPendingApprovals();

  const riskBorderColors: Record<string, string> = {
    low: "border-l-green-500",
    medium: "border-l-amber-500",
    high: "border-l-red-500",
    critical: "border-l-red-600",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and respond to pending approval requests.
          </p>
        </div>
        {approvals.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {approvals.length} pending
          </Badge>
        )}
      </div>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <ShieldCheck className="h-6 w-6 text-green-500" />
            </div>
            <div className="text-center">
              <CardTitle className="text-base">All clear</CardTitle>
              <CardDescription className="mt-1">
                No pending approvals. Your agent is operating normally.
              </CardDescription>
            </div>
          </CardContent>
        </Card>
      ) : (
        approvals.map((approval) => (
          <Card
            key={approval.approvalId}
            className={`border-l-4 ${riskBorderColors[approval.risk || ""] || "border-l-border"}`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{approval.summary}</CardTitle>
                {approval.risk && (
                  <Badge variant={riskColors[approval.risk] ?? "outline"}>
                    {approval.risk}
                  </Badge>
                )}
              </div>
              <CardDescription>
                {new Date(approval.ts).toLocaleString()} · Run: {approval.runId}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {approval.details && (
                <pre className="rounded-md bg-muted p-3 text-xs overflow-auto">
                  {JSON.stringify(approval.details, null, 2)}
                </pre>
              )}
              <ApprovalActions approvalId={approval.approvalId!} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
