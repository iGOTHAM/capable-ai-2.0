import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review and respond to pending approval requests.
        </p>
      </div>

      {/* Empty state */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <CardTitle className="text-base">No pending approvals</CardTitle>
            <CardDescription className="mt-1">
              When your assistant needs approval for an action, it will appear
              here with a risk label and details.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
