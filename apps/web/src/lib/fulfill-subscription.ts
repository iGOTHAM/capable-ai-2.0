import { db } from "@/lib/db";
import type { SubscriptionStatus } from "@prisma/client";
import { deleteDnsRecord } from "@/lib/cloudflare-dns";

/**
 * Creates a subscription record after Stripe checkout completes.
 * Idempotent — if a subscription record already exists for this user, updates it.
 */
export async function createSubscriptionRecord(opts: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date | null;
}) {
  const existing = await db.subscription.findUnique({
    where: { userId: opts.userId },
  });

  if (existing) {
    await db.subscription.update({
      where: { userId: opts.userId },
      data: {
        stripeCustomerId: opts.stripeCustomerId,
        stripeSubscriptionId: opts.stripeSubscriptionId,
        status: opts.status,
        currentPeriodStart: opts.currentPeriodStart,
        currentPeriodEnd: opts.currentPeriodEnd,
        trialEnd: opts.trialEnd ?? null,
      },
    });
    return;
  }

  await db.subscription.create({
    data: {
      userId: opts.userId,
      stripeCustomerId: opts.stripeCustomerId,
      stripeSubscriptionId: opts.stripeSubscriptionId,
      status: opts.status,
      currentPeriodStart: opts.currentPeriodStart,
      currentPeriodEnd: opts.currentPeriodEnd,
      trialEnd: opts.trialEnd ?? null,
    },
  });
}

/**
 * Updates a subscription record from Stripe webhook data.
 */
export async function updateSubscriptionFromStripe(
  stripeSubscriptionId: string,
  data: {
    status?: SubscriptionStatus;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
  },
) {
  const subscription = await db.subscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    console.warn(
      `Subscription not found for stripeSubscriptionId: ${stripeSubscriptionId}`,
    );
    return;
  }

  await db.subscription.update({
    where: { stripeSubscriptionId },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.currentPeriodStart !== undefined && {
        currentPeriodStart: data.currentPeriodStart,
      }),
      ...(data.currentPeriodEnd !== undefined && {
        currentPeriodEnd: data.currentPeriodEnd,
      }),
      ...(data.cancelAtPeriodEnd !== undefined && {
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      }),
      ...(data.canceledAt !== undefined && { canceledAt: data.canceledAt }),
    },
  });
}

/**
 * Handles subscription cancellation: deactivates deployments, deletes DNS
 * records, and marks the subscription as canceled. Called when
 * customer.subscription.deleted fires.
 */
export async function handleSubscriptionCanceled(
  stripeSubscriptionId: string,
) {
  const subscription = await db.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { user: { include: { projects: { include: { deployment: true } } } } },
  });

  if (!subscription) return;

  // Mark subscription as canceled
  await db.subscription.update({
    where: { stripeSubscriptionId },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  });

  // Deactivate all user deployments and clean up DNS
  for (const project of subscription.user.projects) {
    if (project.deployment) {
      // Delete Cloudflare DNS record if one exists
      if (project.deployment.cloudflareRecordId) {
        try {
          await deleteDnsRecord(project.deployment.cloudflareRecordId);
        } catch (err) {
          console.error(
            `Failed to delete DNS record ${project.deployment.cloudflareRecordId} for deployment ${project.deployment.id}:`,
            err,
          );
        }
      }

      await db.deployment.update({
        where: { id: project.deployment.id },
        data: {
          status: "DEACTIVATED",
          cloudflareRecordId: null,
        },
      });
    }
  }
}
