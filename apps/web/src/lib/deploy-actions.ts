"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { db } from "./db";
import { encrypt, decrypt } from "./encryption";
import {
  createDroplet,
  destroyDroplet as doDestroyDroplet,
  getPublicIp,
  refreshAccessToken,
} from "./digitalocean";
import { deleteDnsRecord } from "./cloudflare-dns";
import { generateCloudInitScript } from "./cloud-init";
import { getActiveSubscription } from "./subscription-guard";

type ActionResult = { error?: string };

/**
 * Get a valid (non-expired) DO access token for the current user.
 * Automatically refreshes if expired.
 */
async function getDoToken(userId: string): Promise<{
  token: string;
  error?: string;
}> {
  const doAccount = await db.digitalOceanAccount.findUnique({
    where: { userId },
  });

  if (!doAccount) {
    return { token: "", error: "DigitalOcean account not connected" };
  }

  // Check if token is expired (with 5-min buffer)
  const isExpired =
    doAccount.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return { token: decrypt(doAccount.accessToken) };
  }

  // Refresh the token
  try {
    const refreshToken = decrypt(doAccount.refreshToken);
    const newTokens = await refreshAccessToken(refreshToken);

    const tokenExpiresAt = new Date(
      Date.now() + newTokens.expires_in * 1000,
    );

    await db.digitalOceanAccount.update({
      where: { userId },
      data: {
        accessToken: encrypt(newTokens.access_token),
        refreshToken: encrypt(newTokens.refresh_token),
        tokenExpiresAt,
      },
    });

    return { token: newTokens.access_token };
  } catch {
    // Refresh failed — user needs to re-authenticate
    await db.digitalOceanAccount.delete({ where: { userId } });
    return {
      token: "",
      error: "DigitalOcean session expired. Please reconnect your account.",
    };
  }
}

/**
 * Deploy a droplet for a project via DigitalOcean API.
 */
export async function deployDroplet(
  projectId: string,
  region: string,
  size: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return { error: "Active subscription required" };
  }

  // Verify project belongs to user
  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      deployment: true,
      packVersions: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (!project) return { error: "Project not found" };
  if (!project.deployment) return { error: "No deployment record" };
  if (project.packVersions.length === 0) return { error: "No pack version" };

  // Don't allow deploying if already active
  if (
    project.deployment.status === "ACTIVE" ||
    project.deployment.status === "PROVISIONING"
  ) {
    return { error: "Deployment already in progress or active" };
  }

  // Get DO token
  const { token, error: tokenError } = await getDoToken(user.id);
  if (tokenError) return { error: tokenError };

  // Generate cloud-init script
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cloudInit = generateCloudInitScript({
    appUrl,
    projectId: project.id,
    projectToken: project.deployment.projectToken,
    packVersion: project.packVersions[0]!.version,
    subdomain: project.deployment.subdomain ?? undefined,
  });

  try {
    const dropletName = `capable-${project.deployment.subdomain || project.id}`;

    const droplet = await createDroplet(token, {
      name: dropletName,
      region,
      size,
      userData: cloudInit,
    });

    // Update deployment record
    await db.deployment.update({
      where: { id: project.deployment.id },
      data: {
        status: "PROVISIONING",
        dropletId: String(droplet.id),
        region,
        size,
        deployMethod: "auto",
        dropletIp: getPublicIp(droplet),
      },
    });

    return {};
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create droplet";
    console.error("Deploy droplet error:", message);
    return { error: message };
  }
}

/**
 * Destroy a droplet and clean up DNS.
 */
export async function destroyDeployment(
  projectId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: { deployment: true },
  });

  if (!project?.deployment) return { error: "Deployment not found" };

  const deployment = project.deployment;

  // Destroy droplet on DO if we have the ID and an auto deploy
  if (deployment.dropletId && deployment.deployMethod === "auto") {
    const { token, error: tokenError } = await getDoToken(user.id);
    if (tokenError) return { error: tokenError };

    try {
      await doDestroyDroplet(token, deployment.dropletId);
    } catch (err) {
      console.error("Failed to destroy DO droplet:", err);
      // Continue with cleanup even if DO destroy fails
    }
  }

  // Clean up DNS record
  if (deployment.cloudflareRecordId) {
    try {
      await deleteDnsRecord(deployment.cloudflareRecordId);
    } catch (err) {
      console.error("Failed to delete DNS record:", err);
    }
  }

  // Update deployment status
  await db.deployment.update({
    where: { id: deployment.id },
    data: {
      status: "DEACTIVATED",
      dropletIp: null,
      dropletId: null,
      cloudflareRecordId: null,
    },
  });

  return {};
}

/**
 * Rebuild: destroy the existing droplet and create a fresh one.
 */
export async function rebuildDeployment(
  projectId: string,
  region: string,
  size: string,
): Promise<ActionResult> {
  const destroyResult = await destroyDeployment(projectId);
  if (destroyResult.error) return destroyResult;

  // Reset status to PENDING so deployDroplet allows re-deploy
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const deployment = await db.deployment.findFirst({
    where: { project: { id: projectId, userId: user.id } },
  });

  if (deployment) {
    await db.deployment.update({
      where: { id: deployment.id },
      data: { status: "PENDING" },
    });
  }

  return deployDroplet(projectId, region, size);
}

/**
 * Disconnect the user's DigitalOcean account.
 */
export async function disconnectDigitalOcean(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await db.digitalOceanAccount.deleteMany({
    where: { userId: user.id },
  });

  return {};
}
