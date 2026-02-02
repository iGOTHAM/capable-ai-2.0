import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/subscription-guard";
import { DeployContent } from "@/components/deploy/deploy-content";

export default async function DeployPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;

  // Require active subscription instead of payment
  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    redirect("/settings");
  }

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      deployment: true,
      packVersions: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (!project) notFound();

  // Must have a pack version to deploy
  if (project.packVersions.length === 0) {
    redirect(`/projects/${projectId}`);
  }

  const doReferralUrl =
    process.env.DO_REFERRAL_URL || "https://www.digitalocean.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const latestVersion = project.packVersions[0]?.version ?? 1;

  return (
    <DeployContent
      projectId={projectId}
      projectName={project.name}
      projectToken={project.deployment?.projectToken ?? ""}
      deploymentStatus={project.deployment?.status ?? "PENDING"}
      lastHeartbeat={project.deployment?.lastHeartbeatAt?.toISOString() ?? null}
      dropletIp={project.deployment?.dropletIp ?? null}
      subdomain={project.deployment?.subdomain ?? null}
      doReferralUrl={doReferralUrl}
      appUrl={appUrl}
      latestPackVersion={latestVersion}
    />
  );
}
