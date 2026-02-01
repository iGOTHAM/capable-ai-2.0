"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { createProject } from "@/lib/project-actions";

const templates = [
  {
    id: "pe",
    name: "Private Equity",
    description:
      "Pre-loaded with deal sourcing workflows, due diligence checklists, investment memo templates, and pipeline tracking. Your agent will understand PE terminology, QoE analysis, and fund operations out of the box.",
  },
  {
    id: "legal",
    name: "Legal",
    description:
      "Optimized for contract review, compliance research, and regulatory analysis. Comes with legal document templates, clause libraries, and jurisdiction-aware workflows.",
  },
  {
    id: "healthcare",
    name: "Healthcare",
    description:
      "Built for clinical research support, patient workflow management, and regulatory compliance. Includes medical terminology knowledge and HIPAA-aware operating boundaries.",
  },
  {
    id: "general",
    name: "General",
    description:
      "A flexible starting point for any workflow or domain. Your agent comes with a clean knowledge base you can customize through the dashboard after deployment.",
  },
];

const modes = [
  {
    id: "DRAFT_ONLY",
    name: "Draft Only",
    description:
      "Your agent drafts everything — emails, memos, analyses — but never sends or publishes anything on its own. You review each output and decide what to do with it. Best for getting started or high-stakes workflows.",
    badge: "Safe default",
  },
  {
    id: "ASK_FIRST",
    name: "Do It — Ask Me First",
    description:
      "Your agent can take actions like sending emails or updating records, but it always asks for your approval first through the dashboard. You'll see a notification, review the action, and approve or reject it in real time.",
    badge: "Supervised",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("pe");
  const [mode, setMode] = useState("DRAFT_ONLY");
  const [neverRules, setNeverRules] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const steps = ["Describe", "Knowledge", "Autonomy", "Review"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Your AI Agent</h1>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {steps.length}: {steps[step]}
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step 0: Describe */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Describe your agent</CardTitle>
            <CardDescription>
              Tell us what you want your AI agent to do. This shapes its persona, knowledge,
              and operating style. You can always refine this later by regenerating your pack.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., A PE analyst that sources deals, performs due diligence, and generates investment memos..."
              className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={4}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 1: Template */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base">Choose a knowledge template</CardTitle>
              <CardDescription>
                Templates pre-load your agent with domain-specific knowledge, workflows, and document
                templates. Pick the one closest to your use case — you can customize everything after deployment.
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <Card
                key={t.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${
                  templateId === t.id ? "border-primary ring-1 ring-primary" : ""
                }`}
                onClick={() => setTemplateId(t.id)}
              >
                <CardHeader>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Mode */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base">How should your agent operate?</CardTitle>
              <CardDescription>
                This controls how much autonomy your agent has. You interact with your agent through
                a private dashboard on your server — chatting, reviewing its timeline of work, and
                approving actions when needed.
              </CardDescription>
            </CardHeader>
          </Card>
          {modes.map((m) => (
            <Card
              key={m.id}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${
                mode === m.id ? "border-primary ring-1 ring-primary" : ""
              }`}
              onClick={() => setMode(m.id)}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <Badge variant="secondary">{m.badge}</Badge>
                </div>
                <CardDescription>{m.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Safety boundaries (optional)
              </CardTitle>
              <CardDescription>
                Define hard rules your agent must never break — things it should never do regardless of mode.
                These are baked into your agent&apos;s operating rules and enforced at all times.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={neverRules}
                onChange={(e) => setNeverRules(e.target.value)}
                placeholder="e.g., Never send emails without my review&#10;Never delete CRM records&#10;Never share financial data externally"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; create</CardTitle>
            <CardDescription>
              After payment, we&apos;ll generate your Capable Pack — a complete bundle with your agent&apos;s
              persona, knowledge, memory scaffolding, and dashboard config. You&apos;ll then deploy it to
              your own server and interact with your agent through a private web dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                What your agent does
              </p>
              <p className="text-sm">{description || "No description provided"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Knowledge template
              </p>
              <p className="text-sm">
                {templates.find((t) => t.id === templateId)?.name}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Operating mode</p>
              <p className="text-sm">
                {modes.find((m) => m.id === mode)?.name}{" "}
                <span className="text-muted-foreground">
                  — {modes.find((m) => m.id === mode)?.description.split(".")[0]}.
                </span>
              </p>
            </div>
            {neverRules && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Safety boundaries
                </p>
                <p className="text-sm whitespace-pre-line">{neverRules}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0 || isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              setError("");
              try {
                const rules = neverRules
                  .split("\n")
                  .map((r) => r.trim())
                  .filter(Boolean);

                const result = await createProject({
                  name:
                    templates.find((t) => t.id === templateId)?.name +
                    " Assistant",
                  description,
                  templateId,
                  mode,
                  neverRules: rules,
                });

                if (result.error) {
                  setError(result.error);
                  setIsSubmitting(false);
                  return;
                }

                if (result.projectId) {
                  // Redirect to Stripe checkout
                  const res = await fetch("/api/stripe/create-checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId: result.projectId }),
                  });

                  const data = await res.json();

                  if (data.url) {
                    window.location.href = data.url;
                  } else {
                    setError(data.error || "Failed to create checkout session");
                    setIsSubmitting(false);
                  }
                }
              } catch {
                setError("Something went wrong. Please try again.");
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Create & Pay"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
