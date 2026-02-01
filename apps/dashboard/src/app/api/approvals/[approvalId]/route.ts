import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { appendEvent } from "@/lib/events";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { approvalId } = await params;
  const body = await request.json();
  const { action } = body; // "approve" or "reject"

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Action must be 'approve' or 'reject'" },
      { status: 400 },
    );
  }

  await appendEvent({
    ts: new Date().toISOString(),
    runId: "dashboard",
    type: "approval.resolved",
    summary: `Approval ${approvalId} ${action === "approve" ? "approved" : "rejected"} by user`,
    approvalId,
    details: { action, resolvedAt: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true, action });
}
