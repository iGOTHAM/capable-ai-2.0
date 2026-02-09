import { db } from "@/lib/db";
import type { Subscription } from "@prisma/client";

/**
 * Check if the user has subscription bypass enabled (superadmin toggle).
 */
async function hasSubscriptionBypass(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { subscriptionBypass: true },
  });
  return user?.subscriptionBypass === true;
}

/**
 * Returns the user's active subscription (ACTIVE or TRIALING),
 * or null if they don't have one.
 */
export async function getActiveSubscription(
  userId: string,
): Promise<Subscription | null> {
  // Check bypass first
  if (await hasSubscriptionBypass(userId)) {
    // Return a synthetic subscription so callers don't need null checks
    return {
      id: "bypass",
      userId,
      stripeCustomerId: "bypass",
      stripeSubscriptionId: "bypass",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      trialEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Subscription;
  }

  return db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
  });
}

/**
 * Returns the user's subscription regardless of status, or null.
 */
export async function getSubscription(
  userId: string,
): Promise<Subscription | null> {
  return db.subscription.findUnique({
    where: { userId },
  });
}

/**
 * Throws if the user doesn't have an active or trialing subscription.
 */
export async function requireSubscription(userId: string): Promise<Subscription> {
  const subscription = await getActiveSubscription(userId);
  if (!subscription) {
    throw new Error("Active subscription required");
  }
  return subscription;
}

/**
 * Checks whether the user can create a new project.
 * Single tier: 1 agent max.
 */
export async function canCreateProject(
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await getActiveSubscription(userId);

  if (!subscription) {
    return { allowed: false, reason: "No active subscription" };
  }

  const projectCount = await db.project.count({ where: { userId } });
  const maxProjects = 1; // Single tier limit

  if (projectCount >= maxProjects) {
    return {
      allowed: false,
      reason: `Your plan allows ${maxProjects} agent. Upgrade for more.`,
    };
  }

  return { allowed: true };
}

/**
 * Checks whether the user can deploy (active, trialing, or grace period on past_due).
 */
export async function canDeploy(userId: string): Promise<boolean> {
  // Check bypass first
  if (await hasSubscriptionBypass(userId)) return true;

  const subscription = await db.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) return false;

  return (
    subscription.status === "ACTIVE" ||
    subscription.status === "TRIALING" ||
    subscription.status === "PAST_DUE" // grace period
  );
}
