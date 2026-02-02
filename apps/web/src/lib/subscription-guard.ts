import { db } from "@/lib/db";
import type { Subscription } from "@prisma/client";

/**
 * Returns the user's active subscription (ACTIVE or TRIALING),
 * or null if they don't have one.
 */
export async function getActiveSubscription(
  userId: string,
): Promise<Subscription | null> {
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
