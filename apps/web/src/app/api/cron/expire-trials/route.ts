import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Vercel Cron — runs daily at midnight UTC.
 * Finds all LOCAL trial subscriptions (local_trial_* IDs) whose trialEnd has
 * passed and marks them CANCELED. Does NOT touch real Stripe trials.
 *
 * Intentionally does NOT destroy droplets — the user's agent stays running
 * with a "trial expired" banner so they can subscribe to keep it.
 */
export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const expiredTrials = await db.subscription.findMany({
    where: {
      status: "TRIALING",
      trialEnd: { lt: now },
      stripeSubscriptionId: { startsWith: "local_trial_" },
    },
    select: { id: true, userId: true },
  });

  if (expiredTrials.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  await db.subscription.updateMany({
    where: {
      id: { in: expiredTrials.map((s) => s.id) },
    },
    data: {
      status: "CANCELED",
      canceledAt: now,
    },
  });

  console.log(`Expired ${expiredTrials.length} trial(s):`, expiredTrials.map((s) => s.userId));

  return NextResponse.json({ expired: expiredTrials.length });
}
