import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { fulfillPayment } from "@/lib/fulfill-payment";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    await fulfillPayment(session.id, {
      paymentIntentId: session.payment_intent as string | null,
      customerId: session.customer as string | null,
      amountCents: session.amount_total ?? 0,
    });
  }

  return NextResponse.json({ received: true });
}
