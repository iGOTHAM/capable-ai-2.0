import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await db.subscription.findUnique({
    where: { userId: user.id },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "No subscription found" },
      { status: 404 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  try {
    const stripe = getStripe();

    // Verify the customer exists in the current Stripe mode
    try {
      await stripe.customers.retrieve(subscription.stripeCustomerId);
    } catch {
      // Customer doesn't exist (e.g. test-mode ID with live key) — create a
      // new customer and update the DB so future calls succeed.
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      await db.subscription.update({
        where: { userId: user.id },
        data: { stripeCustomerId: customer.id },
      });
      subscription.stripeCustomerId = customer.id;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe portal error:", message);
    return NextResponse.json(
      { error: `Portal failed: ${message}` },
      { status: 500 },
    );
  }
}
