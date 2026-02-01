import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Rocket,
  Download,
  CheckCircle2,
  XCircle,
  Bot,
  FileText,
  Shield,
  Monitor,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CheckoutButton } from "@/components/checkout-button";
import { RegenerateButton } from "@/components/regenerate-button";
import { getStripe } from "@/lib/stripe";
import { fulfillPayment } from "@/lib/fulfill-payment";
import { templateLabel, modeLabel, MODE_DESCRIPTIONS } from "@/lib/labels";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;
  const { payment } = await searchParams;

  // If returning from Stripe with success, check for pending payments and fulfill
  if (payment === "success") {
    const pendingPayment = await db.payment.findFirst({
      where: { projectId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (pendingPayment?.stripeCheckoutSessionId) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(
          pendingPayment.stripeCheckoutSessionId,
        );

        if (session.payment_status === "paid") {
          await fulfillPayment(session.id, {
            paymentIntentId: session.payment_intent as string | null,
            customerId: session.customer as string | null,
            amountCents: session.amount_total ?? 0,
          });
        }
      } catch (err) {
        console.error("Failed to verify Stripe payment:", err);
      }
    }
  }

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      packVersions: { orderBy: { version: "desc" } },
      deployment: true,
      payments: { where: { status: "COMPLETED" }, take: 1 },
    },
  });

  if (!project) notFound();

  const isPaid = project.payments.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Payment feedback banners */}
      {payment === "success" && isPaid && (
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Payment successful! Your Capable Pack has been generated and is ready to deploy.
        </div>
      )}
      {payment === "cancelled" && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          Payment was cancelled. You can try again when you&apos;re ready.
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {project.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isPaid ? (
            <>
              <RegenerateButton projectId={projectId} />
              <Button asChild>
                <Link href={`/projects/${projectId}/deploy`}>
                  <Rocket className="mr-2 h-4 w-4" />
                  Deploy
                </Link>
              </Button>
            </>
          ) : (
            <CheckoutButton projectId={projectId} />
          )}
        </div>
      </div>

      {/* What you get section — shown after payment */}
      {isPaid && project.packVersions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">What&apos;s in your Capable Pack</CardTitle>
            <CardDescription>
              Your pack contains everything needed to run an AI assistant on your own server.
              Deploy it to a DigitalOcean droplet and interact with your agent through the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">AI Persona &amp; Rules</p>
                  <p className="text-xs text-muted-foreground">
                    Custom personality, operating boundaries, and safety rules tailored to your workflow
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">Knowledge &amp; Memory</p>
                  <p className="text-xs text-muted-foreground">
                    Domain-specific knowledge files and structured memory that persists across sessions
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">Dashboard</p>
                  <p className="text-xs text-muted-foreground">
                    A web interface on your server to see what your agent is doing, approve actions, and chat
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">You Own Everything</p>
                  <p className="text-xs text-muted-foreground">
                    Runs on your server, uses your API keys. We never access your data or credentials
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Template</CardDescription>
            <CardTitle className="text-base">
              {templateLabel(project.templateId)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mode</CardDescription>
            <CardTitle className="text-base">
              <Badge variant="secondary">{modeLabel(project.mode)}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {MODE_DESCRIPTIONS[project.mode]}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-base">
              <Badge
                variant={
                  project.deployment?.status === "ACTIVE"
                    ? "default"
                    : "outline"
                }
              >
                {project.deployment?.status === "ACTIVE"
                  ? "Live"
                  : project.deployment?.status === "PENDING"
                    ? "Ready to deploy"
                    : isPaid
                      ? "Ready to deploy"
                      : "Awaiting payment"}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Next Steps — shown before deployment */}
      {isPaid && (!project.deployment || project.deployment.status === "PENDING") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Steps</CardTitle>
            <CardDescription>
              Your pack is ready. Here&apos;s how to get your AI agent running:
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">1</Badge>
              <div>
                <p className="text-sm font-medium">Deploy to your server</p>
                <p className="text-xs text-muted-foreground">
                  Click Deploy above to get a setup script for your DigitalOcean droplet. It takes about 5 minutes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">2</Badge>
              <div>
                <p className="text-sm font-medium">Open your dashboard</p>
                <p className="text-xs text-muted-foreground">
                  Once deployed, you&apos;ll get a URL and password to access your private dashboard on your server.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">3</Badge>
              <div>
                <p className="text-sm font-medium">Start working with your agent</p>
                <p className="text-xs text-muted-foreground">
                  Use the dashboard to chat with your agent, review its work on the timeline, and approve actions in real time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pack Versions */}
      <Card>
        <CardHeader>
          <CardTitle>Pack Versions</CardTitle>
          <CardDescription>
            Each version contains your agent&apos;s persona, rules, knowledge, and memory configuration.
            Regenerate to update your pack with the latest settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {project.packVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isPaid
                ? "Pack generation in progress..."
                : "Complete payment to generate your first Capable Pack."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {project.packVersions.map((pv) => (
                <div
                  key={pv.id}
                  className="flex items-center justify-between rounded-md border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Badge>v{pv.version}</Badge>
                    <div>
                      <p className="text-sm font-medium">
                        {pv.changelog || "Pack version " + pv.version}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pv.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
