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
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  X,
  Eye,
  Upload,
  FileText,
  Trash2,
  Key,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { createProject } from "@/lib/project-actions";
import {
  KNOWLEDGE_TEMPLATES,
  DEFAULT_PACK_CONFIGS,
  TEMPLATE_NAMES,
} from "@capable-ai/shared";
import type { TemplateId } from "@capable-ai/shared";

const templates = [
  {
    id: "default" as TemplateId,
    name: "Default",
    description:
      "A clean OpenClaw installation with no domain-specific customizations. Same experience as setting up OpenClaw yourself from scratch — just your AI, ready for anything.",
    includes: null,
  },
  {
    id: "pe" as TemplateId,
    name: "Private Equity",
    description:
      "Pre-loaded with deal sourcing workflows, due diligence checklists, investment memo templates, and pipeline tracking. Your agent will understand PE terminology, QoE analysis, and fund operations out of the box.",
    includes: [
      "First Look memo template (IC-ready)",
      "QoE red flags checklist",
      "Prioritized diligence checklist",
      "Pipeline stage tracking",
    ],
  },
  {
    id: "realestate" as TemplateId,
    name: "Real Estate",
    description:
      "Investment memo templates, property due diligence checklists, cap rate and NOI frameworks, and market analysis tools. Covers multifamily, office, industrial, and retail property types.",
    includes: [
      "Investment memo template",
      "Property due diligence checklist",
      "Cap rate, NOI, DSCR formulas",
      "Property type primers (MF, office, industrial, retail)",
    ],
  },
  {
    id: "general" as TemplateId,
    name: "General",
    description:
      "Research frameworks, analysis templates (SWOT, cost-benefit, risk assessment), project planning, and writing templates. A solid foundation for any domain.",
    includes: [
      "SWOT & decision matrix templates",
      "Cost-benefit analysis framework",
      "Executive summary (Pyramid Principle)",
      "Project planning & meeting templates",
    ],
  },
];

const personalities = [
  {
    id: "professional",
    name: "Professional",
    description: "Precise, measured, formal but approachable",
  },
  {
    id: "casual",
    name: "Casual",
    description: "Conversational, friendly, plain language",
  },
  {
    id: "direct",
    name: "Direct",
    description: "Blunt, concise, no filler",
  },
  {
    id: "friendly",
    name: "Friendly",
    description: "Warm, encouraging, collaborative",
  },
];

// Business context field definitions per template
const businessContextFields: Record<
  string,
  {
    key: string;
    label: string;
    placeholder: string;
    type: "text" | "textarea";
  }[]
> = {
  default: [],
  pe: [
    {
      key: "fundName",
      label: "Fund name",
      placeholder: "e.g., Apex Capital Partners",
      type: "text",
    },
    {
      key: "targetEbitda",
      label: "Target EBITDA range",
      placeholder: "e.g., $5M – $25M",
      type: "text",
    },
    {
      key: "sectors",
      label: "Target sectors",
      placeholder:
        "e.g., Healthcare services, B2B software, industrial manufacturing",
      type: "text",
    },
    {
      key: "geography",
      label: "Geographic focus",
      placeholder: "e.g., North America, with preference for Midwest",
      type: "text",
    },
    {
      key: "thesis",
      label: "Investment thesis",
      placeholder:
        "e.g., Platform buildouts in fragmented industries with buy-and-build potential",
      type: "textarea",
    },
  ],
  realestate: [
    {
      key: "firmName",
      label: "Firm name",
      placeholder: "e.g., Summit Capital Real Estate",
      type: "text",
    },
    {
      key: "strategy",
      label: "Investment strategy",
      placeholder: "e.g., Value-add multifamily, core-plus office",
      type: "text",
    },
    {
      key: "propertyTypes",
      label: "Property types",
      placeholder: "e.g., Multifamily, industrial, mixed-use",
      type: "text",
    },
    {
      key: "markets",
      label: "Target markets",
      placeholder: "e.g., Southeast US, Texas metros, Sun Belt",
      type: "text",
    },
    {
      key: "dealSize",
      label: "Deal size range",
      placeholder: "e.g., $5M – $50M",
      type: "text",
    },
  ],
  general: [
    {
      key: "companyName",
      label: "Company / organization",
      placeholder: "e.g., Acme Corp",
      type: "text",
    },
    {
      key: "industry",
      label: "Industry",
      placeholder: "e.g., Technology, manufacturing, consulting",
      type: "text",
    },
    {
      key: "focusArea",
      label: "Your focus area",
      placeholder: "e.g., Product management, strategy, operations",
      type: "text",
    },
    {
      key: "teamContext",
      label: "Team context",
      placeholder:
        "e.g., I lead a 5-person strategy team advising executive leadership",
      type: "textarea",
    },
  ],
};

const AI_MODELS: Record<
  string,
  { id: string; name: string; badge?: string }[]
> = {
  anthropic: [
    {
      id: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      badge: "Recommended",
    },
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5.2", name: "GPT-5.2", badge: "Recommended" },
    { id: "gpt-5-mini", name: "GPT-5 Mini" },
    { id: "gpt-5.2-pro", name: "GPT-5.2 Pro" },
  ],
};

const STEP_LABELS = [
  "Choose Your Vertical",
  "Name Your Bot",
  "Connect Your AI",
  "Review & Create",
];

function NewProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Form state
  const [templateId, setTemplateId] = useState<TemplateId | "">("");
  const [botName, setBotName] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [subdomainStatus, setSubdomainStatus] = useState<{
    available: boolean | null;
    reason?: string;
    preview?: string;
    checking: boolean;
  }>({ available: null, checking: false });

  // AI provider
  const [aiProvider, setAiProvider] = useState("anthropic");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("claude-opus-4-6");
  const [keyValidation, setKeyValidation] = useState<{
    status: "idle" | "validating" | "valid" | "invalid";
    error?: string;
  }>({ status: "idle" });

  // Customization (all optional, defaults from template)
  const [personality, setPersonality] = useState("professional");
  const [description, setDescription] = useState("");
  const [businessContext, setBusinessContext] = useState<
    Record<string, string>
  >({});
  const [customKnowledge, setCustomKnowledge] = useState<
    { filename: string; content: string }[]
  >([]);
  const [neverRules, setNeverRules] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Customization panel state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Get effective values (use defaults if user hasn't customized)
  const effectiveDescription = description.trim()
    ? description
    : templateId
      ? DEFAULT_PACK_CONFIGS[templateId].description
      : "";
  const effectiveNeverRules = neverRules.trim()
    ? neverRules
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean)
    : templateId
      ? DEFAULT_PACK_CONFIGS[templateId].neverRules
      : [];

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
        setKeyValidation({
          status: "invalid",
          error: data.error || "Invalid key",
        });
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
  const handleKnowledgeUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      setUploadError(null);
      const failedFiles: string[] = [];
      let addedCount = 0;

      try {
        for (const file of Array.from(files)) {
          const ext = file.name.split(".").pop()?.toLowerCase();
          const textExts = ["md", "txt", "csv", "json"];
          const binaryExts = ["pdf", "docx", "xlsx"];

          if (
            !textExts.includes(ext || "") &&
            !binaryExts.includes(ext || "")
          ) {
            failedFiles.push(`${file.name} (unsupported format)`);
            continue;
          }
          if (file.size > 2 * 1024 * 1024) {
            failedFiles.push(`${file.name} (exceeds 2MB)`);
            continue;
          }
          if (customKnowledge.length + addedCount >= 10) {
            failedFiles.push(`${file.name} (max 10 files reached)`);
            break;
          }

          let content: string;

          if (textExts.includes(ext || "")) {
            content = await file.text();
          } else {
            // Binary files — send to extraction endpoint
            const formData = new FormData();
            formData.append("file", file);
            try {
              const res = await fetch("/api/files/extract-text", {
                method: "POST",
                body: formData,
              });
              if (!res.ok) {
                failedFiles.push(`${file.name} (extraction failed)`);
                continue;
              }
              const data = await res.json();
              content = data.content;
            } catch {
              failedFiles.push(`${file.name} (extraction failed)`);
              continue;
            }
          }

          setCustomKnowledge((prev) => {
            if (prev.length >= 10) return prev;
            if (prev.some((f) => f.filename === file.name)) return prev;
            return [...prev, { filename: file.name, content }];
          });
          addedCount++;
        }

        // Auto-expand the section so user can see the uploaded files
        if (addedCount > 0) {
          setOpenSections((prev) => ({ ...prev, knowledge: true }));
        }

        if (failedFiles.length > 0) {
          setUploadError(
            `Failed to process: ${failedFiles.join(", ")}`,
          );
        }
      } finally {
        setIsUploading(false);
        // Reset input so same file can be re-uploaded
        e.target.value = "";
      }
    },
    [customKnowledge.length],
  );

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!templateId;
      case 1:
        return botName.length >= 3 && subdomainStatus.available === true;
      case 2:
        return !!aiProvider && !!aiApiKey && !!aiModel && keyValidation.status === "valid";
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleCreate = async () => {
    if (!templateId) return;
    setIsSubmitting(true);
    setError("");
    try {
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
        description: effectiveDescription,
        templateId,
        neverRules: effectiveNeverRules,
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
            }),
          );
        } catch {
          // sessionStorage unavailable
        }
        router.push(`/projects/${result.projectId}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Create Your AI Agent</h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {STEP_LABELS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* ── Step 0: Choose Your Vertical ── */}
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Each pack comes pre-loaded with domain-specific knowledge,
            workflows, and templates. Pick the one closest to your use case.
          </p>
          <div className="grid gap-4">
            {templates.map((t) => {
              const knowledge = KNOWLEDGE_TEMPLATES[t.id];
              const lineCount = knowledge ? knowledge.content.split("\n").length : 0;

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
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{t.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {t.description}
                        </CardDescription>
                      </div>
                      {templateId === t.id && (
                        <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />
                      )}
                    </div>
                  </CardHeader>
                  {t.includes && knowledge && (
                    <CardContent className="pt-0">
                      <div className="mb-3">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                          What&apos;s included ({lineCount} lines of domain
                          knowledge):
                        </p>
                        <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                          {t.includes.map((item) => (
                            <li key={item} className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 shrink-0 text-green-500" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
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
                            <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                              {knowledge.content}
                            </pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 1: Name Your Bot ── */}
      {step === 1 && (
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

      {/* ── Step 2: Connect Your AI ── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Connect your AI provider
            </CardTitle>
            <CardDescription>
              Your API key is sent directly to your server after deployment — it
              never passes through or is stored on capable.ai. You bring your
              own AI, we provide the infrastructure.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Provider selection */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Provider</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    id: "anthropic",
                    name: "Anthropic",
                    desc: "Claude models",
                  },
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
                  placeholder={
                    aiProvider === "anthropic" ? "sk-ant-..." : "sk-..."
                  }
                  className="flex h-10 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  variant="outline"
                  onClick={validateApiKey}
                  disabled={
                    !aiApiKey || keyValidation.status === "validating"
                  }
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
      )}

      {/* ── Step 3: Review & Create ── */}
      {step === 3 && templateId && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Review &amp; create</CardTitle>
              <CardDescription>
                Your {TEMPLATE_NAMES[templateId]} pack is ready to go. Review
                your settings below, then hit &ldquo;Create Agent&rdquo; to
                generate your Capable Pack and set up{" "}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Knowledge pack
                  </p>
                  <p className="text-sm">{TEMPLATE_NAMES[templateId]}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    AI Provider
                  </p>
                  <p className="text-sm">
                    {aiProvider === "anthropic" ? "Anthropic" : "OpenAI"} ·{" "}
                    {(AI_MODELS[aiProvider] ?? []).find(
                      (m) => m.id === aiModel,
                    )?.name || aiModel}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Personality
                </p>
                <p className="text-sm">
                  {personalities.find((p) => p.id === personality)?.name} —{" "}
                  <span className="text-muted-foreground">
                    {
                      personalities.find((p) => p.id === personality)
                        ?.description
                    }
                  </span>
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Mission
                </p>
                <p className="text-sm">{effectiveDescription}</p>
              </div>

              {effectiveNeverRules.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Safety rules
                  </p>
                  <ul className="text-sm">
                    {effectiveNeverRules.map((rule, i) => (
                      <li key={i}>• {rule}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Customization sections (collapsed by default) ── */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings2 className="h-4 w-4" />
            <span>
              Want to customize before creating? Expand any section below.
            </span>
          </div>

          {/* Personality */}
          <Card>
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() => toggleSection("personality")}
            >
              <div>
                <p className="text-sm font-medium">Personality</p>
                <p className="text-xs text-muted-foreground">
                  {personalities.find((p) => p.id === personality)?.name} —{" "}
                  {
                    personalities.find((p) => p.id === personality)
                      ?.description
                  }
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.personality ? "rotate-180" : ""}`}
              />
            </div>
            {openSections.personality && (
              <CardContent className="pt-0">
                <div className="grid gap-3 sm:grid-cols-2">
                  {personalities.map((p) => (
                    <div
                      key={p.id}
                      className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors hover:border-primary/50 ${
                        personality === p.id
                          ? "border-primary ring-1 ring-primary"
                          : ""
                      }`}
                      onClick={() => setPersonality(p.id)}
                    >
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Description / Mission */}
          <Card>
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() => toggleSection("description")}
            >
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm font-medium">Mission Statement</p>
                <p className="truncate text-xs text-muted-foreground">
                  {effectiveDescription}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openSections.description ? "rotate-180" : ""}`}
              />
            </div>
            {openSections.description && (
              <CardContent className="pt-0">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={DEFAULT_PACK_CONFIGS[templateId].description}
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={4}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave blank to use the default mission statement shown above.
                </p>
              </CardContent>
            )}
          </Card>

          {/* Business Context */}
          <Card>
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() => toggleSection("businessContext")}
            >
              <div>
                <p className="text-sm font-medium">Business Context</p>
                <p className="text-xs text-muted-foreground">
                  {Object.values(businessContext).some((v) => v?.trim())
                    ? `${Object.values(businessContext).filter((v) => v?.trim()).length} fields filled`
                    : "No context added yet — your agent will learn through conversation"}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openSections.businessContext ? "rotate-180" : ""}`}
              />
            </div>
            {openSections.businessContext && (
              <CardContent className="flex flex-col gap-4 pt-0">
                {(
                  businessContextFields[templateId] ??
                  businessContextFields.general ??
                  []
                ).map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
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
            )}
          </Card>

          {/* Knowledge Upload */}
          <Card>
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() => toggleSection("knowledge")}
            >
              <div className="flex items-center gap-2">
                {customKnowledge.length > 0 && (
                  <Check className="h-4 w-4 shrink-0 text-green-600" />
                )}
                <div>
                  <p className="text-sm font-medium">Custom Knowledge</p>
                  <p className="text-xs text-muted-foreground">
                    {isUploading
                      ? "Processing files..."
                      : customKnowledge.length > 0
                        ? `${customKnowledge.length} file${customKnowledge.length === 1 ? "" : "s"} uploaded`
                        : "Upload additional documents for your agent"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isUploading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openSections.knowledge ? "rotate-180" : ""}`}
                />
              </div>
            </div>
            {openSections.knowledge && (
              <CardContent className="flex flex-col gap-3 pt-0">
                <label
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground transition-colors ${isUploading ? "pointer-events-none opacity-50" : "hover:bg-muted/50"}`}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>
                    {isUploading
                      ? "Processing files..."
                      : "Upload files (.md, .txt, .csv, .json, .pdf, .docx, .xlsx — max 2MB each, up to 10)"}
                  </span>
                  <input
                    type="file"
                    accept=".md,.txt,.csv,.json,.pdf,.docx,.xlsx"
                    multiple
                    className="hidden"
                    onChange={handleKnowledgeUpload}
                    disabled={isUploading}
                  />
                </label>
                {uploadError && (
                  <p className="text-xs text-destructive">{uploadError}</p>
                )}
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
                              prev.filter(
                                (k) => k.filename !== f.filename,
                              ),
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
            )}
          </Card>

          {/* Safety Rules */}
          <Card>
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() => toggleSection("safety")}
            >
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm font-medium">Safety Rules</p>
                <p className="truncate text-xs text-muted-foreground">
                  {neverRules.trim()
                    ? `${neverRules.split("\n").filter(Boolean).length} custom rule${neverRules.split("\n").filter(Boolean).length === 1 ? "" : "s"}`
                    : `${effectiveNeverRules.length} default rule${effectiveNeverRules.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openSections.safety ? "rotate-180" : ""}`}
              />
            </div>
            {openSections.safety && (
              <CardContent className="pt-0">
                <textarea
                  value={neverRules}
                  onChange={(e) => setNeverRules(e.target.value)}
                  placeholder={effectiveNeverRules.join("\n")}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  One rule per line. Leave blank to use the defaults shown
                  above.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          {error.toLowerCase().includes("subscription") && (
            <span>
              {" "}
              <a href="/settings" className="underline font-medium hover:text-destructive/80">
                Subscribe now &rarr;
              </a>
            </span>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            if (step === 0) {
              router.push("/projects");
            } else {
              setStep(step - 1);
            }
          }}
          disabled={isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={isSubmitting} onClick={handleCreate}>
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
