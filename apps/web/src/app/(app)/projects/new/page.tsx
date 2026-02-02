"use client";

import { useState, useEffect, useCallback } from "react";
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
import { ArrowLeft, ArrowRight, Loader2, Check, X } from "lucide-react";
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

const personalities = [
  {
    id: "professional",
    name: "Professional",
    description: "Precise, measured, formal but approachable",
    example: "I've completed the analysis. Here are the key findings...",
  },
  {
    id: "casual",
    name: "Casual",
    description: "Conversational, friendly, plain language",
    example: "Hey! Just finished looking into that. Here's what I found...",
  },
  {
    id: "direct",
    name: "Direct",
    description: "Blunt, concise, no filler",
    example: "Done. Three issues found. Top priority: revenue recognition.",
  },
  {
    id: "friendly",
    name: "Friendly",
    description: "Warm, encouraging, collaborative",
    example: "Great question! I dug into this and found some interesting things...",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // New fields
  const [botName, setBotName] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [personality, setPersonality] = useState("professional");
  const [subdomainStatus, setSubdomainStatus] = useState<{
    available: boolean | null;
    reason?: string;
    preview?: string;
    checking: boolean;
  }>({ available: null, checking: false });

  // Existing fields
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("pe");
  const [mode, setMode] = useState("DRAFT_ONLY");
  const [neverRules, setNeverRules] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const steps = [
    "Name Your Bot",
    "Personality",
    "Describe",
    "Knowledge",
    "Autonomy",
    "Review",
  ];

  // Debounced subdomain check
  const checkSubdomain = useCallback(async (name: string) => {
    if (name.length < 3) {
      setSubdomainStatus({ available: null, checking: false });
      return;
    }
    setSubdomainStatus((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch(
        `/api/subdomains/check?name=${encodeURIComponent(name)}`,
      );
      const data = await res.json();
      setSubdomainStatus({
        available: data.available ?? false,
        reason: data.reason,
        preview: data.preview,
        checking: false,
      });
    } catch {
      setSubdomainStatus({
        available: null,
        checking: false,
        reason: "Check failed",
      });
    }
  }, []);

  useEffect(() => {
    const normalized = botName.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (normalized.length < 3) {
      setSubdomainStatus({ available: null, checking: false });
      return;
    }
    const timer = setTimeout(() => checkSubdomain(normalized), 400);
    return () => clearTimeout(timer);
  }, [botName, checkSubdomain]);

  const canProceed = () => {
    switch (step) {
      case 0:
        return botName.length >= 3 && subdomainStatus.available === true;
      case 1:
        return !!personality;
      case 2:
        return description.length > 0;
      case 3:
        return !!templateId;
      case 4:
        return !!mode;
      case 5:
        return true;
      default:
        return false;
    }
  };

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

      {/* Step 0: Name Your Bot */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Name your agent</CardTitle>
            <CardDescription>
              Choose a name for your AI agent. This also becomes your dashboard
              URL at <strong>name.capable.ai</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Bot name</label>
              <input
                type="text"
                value={botName}
                onChange={(e) =>
                  setBotName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                placeholder="e.g., jarvis, aria, atlas"
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {botName.length >= 3 && (
                <div className="flex items-center gap-2 text-sm">
                  {subdomainStatus.checking ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : subdomainStatus.available ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : subdomainStatus.available === false ? (
                    <X className="h-3 w-3 text-destructive" />
                  ) : null}
                  <span
                    className={
                      subdomainStatus.available
                        ? "text-green-500"
                        : subdomainStatus.available === false
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {subdomainStatus.checking
                      ? "Checking..."
                      : subdomainStatus.available
                        ? `${botName}.capable.ai is available`
                        : subdomainStatus.reason
                          ? subdomainStatus.reason
                          : ""}
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  Your name{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g., Sarah"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  Your role{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="text"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  placeholder="e.g., Managing Partner"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Personality */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base">
                Choose a personality tone
              </CardTitle>
              <CardDescription>
                This shapes how your agent communicates. You can always fine-tune
                this by editing SOUL.md after deployment.
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {personalities.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${
                  personality === p.id
                    ? "border-primary ring-1 ring-primary"
                    : ""
                }`}
                onClick={() => setPersonality(p.id)}
              >
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="rounded-md bg-muted px-3 py-2 text-sm italic text-muted-foreground">
                    &ldquo;{p.example}&rdquo;
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Describe */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Describe your agent</CardTitle>
            <CardDescription>
              Tell us what you want your AI agent to do. This shapes its persona,
              knowledge, and operating style. You can always refine this later by
              regenerating your pack.
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

      {/* Step 3: Template */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base">
                Choose a knowledge template
              </CardTitle>
              <CardDescription>
                Templates pre-load your agent with domain-specific knowledge,
                workflows, and document templates. Pick the one closest to your
                use case — you can customize everything after deployment.
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <Card
                key={t.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${
                  templateId === t.id
                    ? "border-primary ring-1 ring-primary"
                    : ""
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

      {/* Step 4: Mode */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base">
                How should your agent operate?
              </CardTitle>
              <CardDescription>
                This controls how much autonomy your agent has. You interact with
                your agent through a private dashboard on your server — chatting,
                reviewing its timeline of work, and approving actions when
                needed.
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
                Define hard rules your agent must never break — things it should
                never do regardless of mode. These are baked into your
                agent&apos;s operating rules and enforced at all times.
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

      {/* Step 5: Review */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; create</CardTitle>
            <CardDescription>
              Your Capable Pack will be generated immediately — a complete bundle
              with your agent&apos;s persona, knowledge, memory scaffolding, and
              dashboard config. You&apos;ll then deploy it to your own server at{" "}
              <strong>{botName}.capable.ai</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Agent name
                </p>
                <p className="text-sm">{botName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Dashboard URL
                </p>
                <p className="text-sm font-mono text-primary">
                  {botName}.capable.ai
                </p>
              </div>
              {userName && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Your name
                  </p>
                  <p className="text-sm">{userName}</p>
                </div>
              )}
              {userRole && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Your role
                  </p>
                  <p className="text-sm">{userRole}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Personality
              </p>
              <p className="text-sm">
                {personalities.find((p) => p.id === personality)?.name}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                What your agent does
              </p>
              <p className="text-sm">
                {description || "No description provided"}
              </p>
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
              <p className="text-sm font-medium text-muted-foreground">
                Operating mode
              </p>
              <p className="text-sm">
                {modes.find((m) => m.id === mode)?.name}{" "}
                <span className="text-muted-foreground">
                  — {modes.find((m) => m.id === mode)?.description.split(".")[0]}
                  .
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
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
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
                  botName,
                  userName: userName || undefined,
                  userRole: userRole || undefined,
                  personality,
                  name: botName,
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
                  router.push(`/projects/${result.projectId}`);
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
                Creating...
              </>
            ) : (
              "Create Agent"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
