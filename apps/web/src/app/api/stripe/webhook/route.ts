import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  createSubscriptionRecord,
  updateSubscriptionFromStripe,
  handleSubscriptionCanceled,
} from "@/lib/fulfill-subscription";
import type Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";

/** Map Stripe subscription status to our enum. */
function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "trialing":
      return "TRIALING";
    case "unpaid":
      return "UNPAID";
    default:
      return "ACTIVE";
  }
}

/**
 * Extract billing period from a subscription.
 * In Stripe v20+, current_period_start/end moved from Subscription to SubscriptionItem.
 */
function getBillingPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0];
  if (item) {
    return {
      start: new Date(item.current_period_start * 1000),
      end: new Date(item.current_period_end * 1000),
    };
  }
  // Fallback: use billing_cycle_anchor as start, estimate end 30 days later
  return {
    start: new Date(subscription.billing_cycle_anchor * 1000),
    end: new Date((subscription.billing_cycle_anchor + 30 * 86400) * 1000),
  };
}

/**
 * Extract subscription ID from an invoice.
 * In Stripe v20+, `invoice.subscription` moved to `invoice.parent.subscription_details.subscription`.
 */
function getSubscriptionIdFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

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

  try {
    switch (event.type) {
      // ─── Subscription created via checkout ───
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only handle subscription checkouts (not legacy one-time payments)
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.userId;
        if (!userId) {
          console.error("checkout.session.completed: missing userId in metadata");
          break;
        }

        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );

        const period = getBillingPeriod(subscription);

        await createSubscriptionRecord({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          status: mapStripeStatus(subscription.status),
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
        });
        break;
      }

      // ─── Successful payment (renewal or first charge after trial) ───
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = getSubscriptionIdFromInvoice(invoice);
        if (!subId) break;

        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(subId);

        const period = getBillingPeriod(subscription);

        await updateSubscriptionFromStripe(subId, {
          status: mapStripeStatus(subscription.status),
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
        });
        break;
      }

      // ─── Subscription updated (upgrade, downgrade, cancel-at-period-end) ───
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const period = getBillingPeriod(subscription);

        await updateSubscriptionFromStripe(subscription.id, {
          status: mapStripeStatus(subscription.status),
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : null,
        });
        break;
      }

      // ─── Subscription fully canceled ───
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription.id);
        break;
      }

      // ─── Payment failed ───
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = getSubscriptionIdFromInvoice(invoice);
        if (!subId) break;

        await updateSubscriptionFromStripe(subId, {
          status: "PAST_DUE",
        });
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook handler error for ${event.type}:`, message);
    // Return 200 so Stripe doesn't retry (we log the error above)
  }

  return NextResponse.json({ received: true });
}
