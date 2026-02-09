import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/subscription-guard";
import { DeployContent } from "@/components/deploy/deploy-content";
import { getDecryptedCredentials } from "@/lib/deployment-credentials";

export default async function DeployPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    redirect("/settings");
  }

  const [project, doAccount] = await Promise.all([
    db.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: {
        deployment: true,
        packVersions: { orderBy: { version: "desc" }, take: 1 },
      },
    }),
    db.digitalOceanAccount.findUnique({
      where: { userId: user.id },
      select: {
        doAccountEmail: true,
        tokenExpiresAt: true,
      },
    }),
  ]);

  if (!project) notFound();

  if (project.packVersions.length === 0) {
    redirect(`/projects/${projectId}`);
  }

  const doReferralUrl =
    process.env.DO_REFERRAL_URL || "https://www.digitalocean.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const latestVersion = project.packVersions[0]?.version ?? 1;

  const heartbeatData = project.deployment?.heartbeatData as Record<string, unknown> | null;
  const decryptedCreds = getDecryptedCredentials(heartbeatData);

  return (
    <DeployContent
      projectId={projectId}
      projectName={project.name}
      projectToken={project.deployment?.projectToken ?? ""}
      deploymentStatus={project.deployment?.status ?? "PENDING"}
      lastHeartbeat={
        project.deployment?.lastHeartbeatAt?.toISOString() ?? null
      }
      dropletIp={project.deployment?.dropletIp ?? null}
      subdomain={project.deployment?.subdomain ?? null}
      deployMethod={project.deployment?.deployMethod ?? null}
      dropletRegion={project.deployment?.region ?? null}
      dropletSize={project.deployment?.size ?? null}
      doConnected={!!doAccount}
      doEmail={doAccount?.doAccountEmail ?? null}
      doReferralUrl={doReferralUrl}
      appUrl={appUrl}
      latestPackVersion={latestVersion}
      dashboardPassword={decryptedCreds.dashboardPassword}
      gatewayToken={decryptedCreds.gatewayToken}
      provider={project.provider ?? null}
      aiModel={project.aiModel ?? null}
    />
  );
}
