import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { createSubscriptionRecord } from "@/lib/fulfill-subscription";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/verify-email?error=missing_token", request.url),
    );
  }

  const verificationToken = await db.verificationToken.findUnique({
    where: { token },
  });

  if (
    !verificationToken ||
    verificationToken.type !== "email_verification"
  ) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid_token", request.url),
    );
  }

  if (verificationToken.expiresAt < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return NextResponse.redirect(
      new URL(
        `/verify-email?error=expired&email=${encodeURIComponent(verificationToken.identifier)}`,
        request.url,
      ),
    );
  }

  const email = verificationToken.identifier;

  // Mark email as verified
  const user = await db.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  // Delete the used token
  await db.verificationToken.delete({ where: { token } });

  // Create 7-day free trial (local — no Stripe involved)
  const existingSub = await db.subscription.findUnique({
    where: { userId: user.id },
  });
  if (!existingSub) {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await createSubscriptionRecord({
      userId: user.id,
      stripeCustomerId: `local_trial_cust_${user.id}`,
      stripeSubscriptionId: `local_trial_sub_${user.id}`,
      status: "TRIALING",
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnd,
      trialEnd,
    });
  }

  // Create session and redirect to projects
  await createSession(user.id);

  return NextResponse.redirect(
    new URL("/projects?verified=true", request.url),
  );
}
