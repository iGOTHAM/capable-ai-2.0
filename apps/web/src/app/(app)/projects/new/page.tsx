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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2, Check, X, Eye, Upload, FileText, Trash2, Key } from "lucide-react";
import Link from "next/link";
import { createProject } from "@/lib/project-actions";
import { KNOWLEDGE_TEMPLATES } from "@capable-ai/shared";
import type { TemplateId } from "@capable-ai/shared";


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
      "Contract review frameworks, compliance research, regulatory analysis, and due diligence checklists. Comes with risk allocation tables, IP provisions, and memo formats.",
  },
  {
    id: "healthcare",
    name: "Healthcare",
    description:
      "Clinical research assessment, FDA regulatory pathways, quality metrics, and compliance checkpoints. Includes evidence hierarchy, study evaluation frameworks, and HIPAA-aware boundaries.",
  },
  {
    id: "general",
    name: "General",
    description:
      "Research frameworks, analysis templates (SWOT, cost-benefit, risk assessment), project planning, and writing templates. A solid foundation for any domain.",
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

// Business context field definitions per template
const businessContextFields: Record<string, { key: string; label: string; placeholder: string; type: "text" | "textarea" | "select"; options?: string[] }[]> = {
  pe: [
    { key: "fundName", label: "Fund name", placeholder: "e.g., Apex Capital Partners", type: "text" },
    { key: "targetEbitda", label: "Target EBITDA range", placeholder: "e.g., $5M – $25M", type: "text" },
    { key: "sectors", label: "Target sectors", placeholder: "e.g., Healthcare services, B2B software, industrial manufacturing", type: "text" },
    { key: "geography", label: "Geographic focus", placeholder: "e.g., North America, with preference for Midwest", type: "text" },
    { key: "thesis", label: "Investment thesis", placeholder: "e.g., Platform buildouts in fragmented industries with buy-and-build potential", type: "textarea" },
  ],
  legal: [
    { key: "firmName", label: "Firm / practice name", placeholder: "e.g., Smith & Associates LLP", type: "text" },
    { key: "practiceAreas", label: "Primary practice areas", placeholder: "e.g., M&A, IP licensing, employment law", type: "text" },
    { key: "jurisdictions", label: "Jurisdictions", placeholder: "e.g., Delaware, New York, California", type: "text" },
    { key: "clientTypes", label: "Client types", placeholder: "e.g., PE sponsors, portfolio companies, founders", type: "text" },
  ],
  healthcare: [
    { key: "organizationName", label: "Organization name", placeholder: "e.g., Mercy Health System", type: "text" },
    { key: "organizationType", label: "Organization type", placeholder: "Select...", type: "select", options: ["Hospital System", "Medical Practice", "Research Institution", "Payer", "Health Tech", "Other"] },
    { key: "specialtyFocus", label: "Specialty focus", placeholder: "e.g., Cardiology, oncology, primary care", type: "text" },
    { key: "patientPopulation", label: "Patient population", placeholder: "e.g., Medicare Advantage, commercial, Medicaid", type: "text" },
  ],
  general: [
    { key: "companyName", label: "Company / organization", placeholder: "e.g., Acme Corp", type: "text" },
    { key: "industry", label: "Industry", placeholder: "e.g., Technology, manufacturing, consulting", type: "text" },
    { key: "focusArea", label: "Your focus area", placeholder: "e.g., Product management, strategy, operations", type: "text" },
    { key: "teamContext", label: "Team context", placeholder: "e.g., I lead a 5-person strategy team advising executive leadership", type: "textarea" },
  ],
};

// Better description placeholders per template
const descriptionPlaceholders: Record<string, string> = {
  pe: "e.g., I need an agent that can screen inbound deals quickly, produce First Look memos for our IC, track our pipeline, and help with due diligence workstreams.",
  legal: "e.g., I need an agent that can review NDAs and vendor contracts, flag non-standard terms, track contract deadlines, and prepare due diligence checklists.",
  healthcare: "e.g., I need an agent that can review clinical trial data, summarize FDA guidance, track regulatory timelines, and help prepare submissions.",
  general: "e.g., I need an agent that can research topics quickly, draft briefing documents, track project status, and help prepare presentations.",
};

const AI_MODELS: Record<string, { id: string; name: string; badge?: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-5-20251101", name: "Claude Sonnet 4.5", badge: "Recommended" },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
    { id: "claude-haiku-4-20250414", name: "Claude Haiku 4" },
  ],
  openai: [
    { id: "gpt-5.2", name: "GPT-5.2", badge: "Recommended" },
    { id: "gpt-5-mini", name: "GPT-5 Mini" },
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
    { id: "o4-mini", name: "o4-mini" },
  ],
};

const TOTAL_STEPS = 7;

function getStepFromUrl(): number {
  if (typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  const raw = Number(params.get("step") ?? "0");
  return Number.isNaN(raw) ? 0 : Math.max(0, Math.min(raw, TOTAL_STEPS - 1));
}

function NewProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState(getStepFromUrl);

  // Sync step to URL via history API (no Next.js navigation = no remount)
  const navigateToStep = useCallback((newStep: number) => {
    setStep(newStep);
    window.history.pushState(null, "", `/projects/new?step=${newStep}`);
  }, []);

  // Listen for browser back/forward
  useEffect(() => {
    const onPopState = () => {
      setStep(getStepFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Form state
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

  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("pe");
  const [businessContext, setBusinessContext] = useState<Record<string, string>>({});
  const [customKnowledge, setCustomKnowledge] = useState<{ filename: string; content: string }[]>([]);
  const [neverRules, setNeverRules] = useState("");
  const [aiProvider, setAiProvider] = useState("anthropic");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("claude-sonnet-4-5-20251101");
  const [keyValidation, setKeyValidation] = useState<{
    status: "idle" | "validating" | "valid" | "invalid";
    error?: string;
  }>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const steps = [
    "Name Your Bot",
    "Personality",
    "Describe",
    "Knowledge",
    "Business Context",
    "Connect Your AI",
    "Review",
  ];

  // Reset model when provider changes
  const handleProviderChange = (provider: string) => {
    setAiProvider(provider);
    const models = AI_MODELS[provider];
    if (models && models.length > 0) {
      setAiModel(models[0]!.id);
    }
    setKeyValidation({ status: "idle" });
  };

  const validateApiKey = async () => {
    if (!aiApiKey) return;
    setKeyValidation({ status: "validating" });
    try {
      const res = await fetch("/api/ai/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey }),
      });
      const data = await res.json();
      if (data.valid) {
        setKeyValidation({ status: "valid" });
      } else {
        setKeyValidation({ status: "invalid", error: data.error || "Invalid key" });
      }
    } catch {
      setKeyValidation({ status: "invalid", error: "Validation failed" });
    }
  };

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

  // Handle knowledge file upload
  const handleKnowledgeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      // Validate: only .md and .txt, max 500KB
      if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) continue;
      if (file.size > 500 * 1024) continue;
      if (customKnowledge.length >= 5) break;

      const content = await file.text();
      setCustomKnowledge((prev) => {
        if (prev.length >= 5) return prev;
        if (prev.some((f) => f.filename === file.name)) return prev;
        return [...prev, { filename: file.name, content }];
      });
    }

    // Reset input so same file can be re-uploaded
    e.target.value = "";
  }, [customKnowledge.length]);

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
        return true; // Business context is optional
      case 5:
        return !!aiProvider && !!aiApiKey && !!aiModel;
      case 6:
        return true; // Review
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
              Tell us what you want your AI agent to do. This becomes the
              agent&apos;s mission statement — its north star for how to
              prioritize and approach tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={descriptionPlaceholders[templateId] || descriptionPlaceholders.general}
              className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={4}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Knowledge Template + Custom Upload */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base">
                Choose a knowledge template
              </CardTitle>
              <CardDescription>
                Templates pre-load your agent with domain-specific frameworks,
                checklists, and reference material. Pick the one closest to your
                use case — you can customize everything after deployment.
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => {
              const knowledge =
                KNOWLEDGE_TEMPLATES[t.id as TemplateId];
              const lineCount = knowledge.content.split("\n").length;

              return (
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
                    <p className="text-xs text-muted-foreground/70">
                      {lineCount} lines of domain knowledge
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye className="mr-1.5 h-3 w-3" />
                          Preview knowledge
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div
                          className="mt-2 max-h-64 overflow-y-auto rounded-md bg-muted p-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono">
                            {knowledge.content}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Custom Knowledge Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Add your own knowledge{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </CardTitle>
              <CardDescription>
                Upload .md or .txt files with your firm&apos;s frameworks,
                checklists, or reference materials. These are added alongside
                the template knowledge.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                <Upload className="h-4 w-4" />
                <span>Upload files (.md, .txt — max 500KB each, up to 5)</span>
                <input
                  type="file"
                  accept=".md,.txt"
                  multiple
                  className="hidden"
                  onChange={handleKnowledgeUpload}
                />
              </label>
              {customKnowledge.length > 0 && (
                <div className="flex flex-col gap-2">
                  {customKnowledge.map((f) => (
                    <div
                      key={f.filename}
                      className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{f.filename}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(f.content.length / 1024).toFixed(1)}KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          setCustomKnowledge((prev) =>
                            prev.filter((k) => k.filename !== f.filename),
                          )
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Business Context */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {templateId === "pe"
                ? "Tell us about your fund"
                : templateId === "legal"
                  ? "Tell us about your practice"
                  : templateId === "healthcare"
                    ? "Tell us about your organization"
                    : "Tell us about your work"}
            </CardTitle>
            <CardDescription>
              This context helps your agent understand your priorities and
              criteria from day one. All fields are optional — your agent will
              learn more through conversation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(businessContextFields[templateId] ?? businessContextFields.general ?? []).map((field) => (
              <div key={field.key} className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  {field.label}{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={businessContext[field.key] || ""}
                    onChange={(e) =>
                      setBusinessContext((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={3}
                  />
                ) : field.type === "select" && field.options ? (
                  <select
                    value={businessContext[field.key] || ""}
                    onChange={(e) =>
                      setBusinessContext((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={businessContext[field.key] || ""}
                    onChange={(e) =>
                      setBusinessContext((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Safety boundaries (optional)
              </CardTitle>
              <CardDescription>
                Define hard rules your agent must never break. These are baked
                into your agent&apos;s operating rules and enforced at all times.
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

      {/* Step 5: Connect Your AI */}
      {step === 5 && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Connect your AI provider
              </CardTitle>
              <CardDescription>
                Your API key is sent directly to your server after deployment — it
                never passes through or is stored on capable.ai. You bring your own
                AI, we provide the infrastructure.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {/* Provider selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Provider</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { id: "anthropic", name: "Anthropic", desc: "Claude models" },
                    { id: "openai", name: "OpenAI", desc: "GPT models" },
                  ].map((p) => (
                    <div
                      key={p.id}
                      className={`cursor-pointer rounded-md border p-3 transition-colors hover:border-primary/50 ${
                        aiProvider === p.id
                          ? "border-primary ring-1 ring-primary"
                          : ""
                      }`}
                      onClick={() => handleProviderChange(p.id)}
                    >
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* API Key input */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => {
                      setAiApiKey(e.target.value);
                      setKeyValidation({ status: "idle" });
                    }}
                    placeholder={aiProvider === "anthropic" ? "sk-ant-..." : "sk-..."}
                    className="flex h-10 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button
                    variant="outline"
                    onClick={validateApiKey}
                    disabled={!aiApiKey || keyValidation.status === "validating"}
                  >
                    {keyValidation.status === "validating" ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : keyValidation.status === "valid" ? (
                      <Check className="mr-1 h-3 w-3 text-green-500" />
                    ) : null}
                    {keyValidation.status === "valid" ? "Valid" : "Validate"}
                  </Button>
                </div>
                {keyValidation.status === "valid" && (
                  <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" />
                    API key is valid
                  </p>
                )}
                {keyValidation.status === "invalid" && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <X className="h-3 w-3" />
                    {keyValidation.error || "Invalid API key"}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  {aiProvider === "anthropic" ? (
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      console.anthropic.com
                    </a>
                  ) : (
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      platform.openai.com
                    </a>
                  )}
                </p>
              </div>

              {/* Model selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Model</label>
                <div className="flex flex-col gap-2">
                  {(AI_MODELS[aiProvider] ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors hover:border-primary/50 ${
                        aiModel === m.id
                          ? "border-primary ring-1 ring-primary"
                          : ""
                      }`}
                      onClick={() => setAiModel(m.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        {m.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {m.badge}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 6: Review */}
      {step === 6 && (
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
                {customKnowledge.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    + {customKnowledge.length} custom{" "}
                    {customKnowledge.length === 1 ? "file" : "files"}
                  </span>
                )}
              </p>
            </div>
            {/* Business context summary */}
            {Object.values(businessContext).some((v) => v && v.trim()) && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Business context
                </p>
                <div className="text-sm">
                  {Object.entries(businessContext)
                    .filter(([, v]) => v && v.trim())
                    .map(([k, v]) => {
                      const fields = businessContextFields[templateId] ?? businessContextFields.general ?? [];
                      const field = fields.find((f: { key: string }) => f.key === k);
                      return (
                        <p key={k}>
                          <span className="text-muted-foreground">{field?.label || k}:</span>{" "}
                          {v}
                        </p>
                      );
                    })}
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                AI Provider
              </p>
              <p className="text-sm">
                {aiProvider === "anthropic" ? "Anthropic" : "OpenAI"} ·{" "}
                {(AI_MODELS[aiProvider] ?? []).find((m) => m.id === aiModel)?.name || aiModel}
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
          onClick={() => navigateToStep(Math.max(0, step - 1))}
          disabled={step === 0 || isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step < steps.length - 1 ? (
          <Button
            onClick={() => navigateToStep(step + 1)}
            disabled={!canProceed()}
          >
            {step === 4 ? "Skip" : "Next"}
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

                // Filter empty business context values
                const filteredContext = Object.fromEntries(
                  Object.entries(businessContext).filter(([, v]) => v && v.trim()),
                );

                const result = await createProject({
                  botName,
                  userName: userName || undefined,
                  userRole: userRole || undefined,
                  personality,
                  name: botName,
                  description,
                  templateId,
                  neverRules: rules,
                  provider: aiProvider,
                  model: aiModel,
                  businessContext:
                    Object.keys(filteredContext).length > 0
                      ? filteredContext
                      : undefined,
                  customKnowledge:
                    customKnowledge.length > 0 ? customKnowledge : undefined,
                });

                if (result.error) {
                  setError(result.error);
                  setIsSubmitting(false);
                  return;
                }

                if (result.projectId) {
                  // Save API key to sessionStorage for deploy page to send to droplet
                  // Key is NEVER stored in our database — only passed to the user's droplet
                  try {
                    sessionStorage.setItem(
                      "capable_ai_key",
                      JSON.stringify({
                        provider: aiProvider,
                        apiKey: aiApiKey,
                        model: aiModel,
                      })
                    );
                  } catch {
                    // sessionStorage unavailable — user will need to enter key manually on deploy page
                  }
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


export default function NewProjectPage() {
  return <NewProjectWizard />;
}
