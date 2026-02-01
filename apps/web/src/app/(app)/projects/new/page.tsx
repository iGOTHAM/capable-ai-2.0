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
    description: "Deal sourcing, due diligence, investment memos, pipeline tracking.",
  },
  {
    id: "legal",
    name: "Legal",
    description: "Contract review, compliance research, regulatory analysis.",
  },
  {
    id: "healthcare",
    name: "Healthcare",
    description: "Clinical research, patient workflow, regulatory compliance.",
  },
  {
    id: "general",
    name: "General",
    description: "Flexible assistant for any workflow or domain.",
  },
];

const modes = [
  {
    id: "DRAFT_ONLY",
    name: "Draft Only",
    description:
      "Never takes external actions. Drafts everything for your review and copy/paste.",
    badge: "Safe default",
  },
  {
    id: "ASK_FIRST",
    name: "Do It — Ask Me First",
    description:
      "Can take actions but always asks for approval via the dashboard before executing.",
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

  const steps = ["Describe", "Template", "Mode", "Review"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Project</h1>
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
            <CardTitle>Describe your bot</CardTitle>
            <CardDescription>
              In 1–2 sentences, describe what you want your AI assistant to do.
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
      )}

      {/* Step 2: Mode */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
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
                Never do this (optional)
              </CardTitle>
              <CardDescription>
                Add rules for things your bot should never do, one per line.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={neverRules}
                onChange={(e) => setNeverRules(e.target.value)}
                placeholder="e.g., Never send emails without my review&#10;Never delete CRM records"
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
            <CardTitle>Review your project</CardTitle>
            <CardDescription>
              Confirm your settings before proceeding to payment.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Description
              </p>
              <p className="text-sm">{description || "No description"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Template
              </p>
              <p className="text-sm">
                {templates.find((t) => t.id === templateId)?.name}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Mode</p>
              <p className="text-sm">
                {modes.find((m) => m.id === mode)?.name}
              </p>
            </div>
            {neverRules && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Never rules
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
