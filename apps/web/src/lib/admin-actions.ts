"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { isSuperAdmin } from "./superadmin";
import { db } from "./db";
import { getStripe } from "./stripe";
import { destroyDroplet } from "./digitalocean";
import { deleteDnsRecord } from "./cloudflare-dns";
import { decrypt } from "./encryption";

export type DeleteUserResult = {
  error?: string;
};

/**
 * Delete a user and clean up all associated infrastructure:
 * 1. Cancel Stripe subscription
 * 2. Destroy auto-deployed DO droplets
 * 3. Delete Cloudflare DNS records
 * 4. Cascade-delete user from database (sessions, projects, packVersions, deployments, payments, subscription, doAccount)
 *
 * All external API calls are best-effort — failures are logged but don't block deletion.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  if (!isSuperAdmin(currentUser.email)) {
    return { error: "Unauthorized" };
  }

  if (userId === currentUser.id) {
    return { error: "Cannot delete your own account" };
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      projects: { include: { deployment: true } },
      doAccount: true,
    },
  });

  if (!targetUser) {
    return { error: "User not found" };
  }

  // 1. Cancel Stripe subscription
  if (targetUser.subscription?.stripeSubscriptionId) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(
        targetUser.subscription.stripeSubscriptionId,
      );
    } catch (err) {
      console.error(
        `Failed to cancel Stripe subscription for ${targetUser.email}:`,
        err,
      );
    }
  }

  // 2. Destroy DO droplets + DNS records for each project
  for (const project of targetUser.projects) {
    const deployment = project.deployment;
    if (!deployment) continue;
    if (deployment.status === "DEACTIVATED") continue;

    // Destroy DO droplet (only auto-deployed)
    if (
      deployment.dropletId &&
      deployment.deployMethod === "auto" &&
      targetUser.doAccount
    ) {
      try {
        const token = decrypt(targetUser.doAccount.accessToken);
        await destroyDroplet(token, deployment.dropletId);
      } catch (err) {
        console.error(
          `Failed to destroy droplet ${deployment.dropletId} for ${targetUser.email}:`,
          err,
        );
      }
    }

    // Delete DNS record
    if (deployment.cloudflareRecordId) {
      try {
        await deleteDnsRecord(deployment.cloudflareRecordId);
      } catch (err) {
        console.error(
          `Failed to delete DNS record for ${targetUser.email}:`,
          err,
        );
      }
    }
  }

  // 3. Delete user — Prisma cascades handle everything
  await db.user.delete({ where: { id: userId } });

  return {};
}
