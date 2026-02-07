"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { updateProject } from "@/lib/project-actions";

const PERSONALITY_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "direct", label: "Direct" },
  { value: "friendly", label: "Friendly" },
] as const;

const BUSINESS_CONTEXT_FIELDS: Record<
  string,
  { key: string; label: string }[]
> = {
  pe: [
    { key: "fundName", label: "Fund name" },
    { key: "targetEbitda", label: "Target EBITDA range" },
    { key: "sectors", label: "Target sectors" },
    { key: "geography", label: "Geographic focus" },
    { key: "thesis", label: "Investment thesis" },
  ],
  realestate: [
    { key: "firmName", label: "Firm name" },
    { key: "strategy", label: "Investment strategy" },
    { key: "propertyTypes", label: "Property types" },
    { key: "markets", label: "Target markets" },
    { key: "dealSize", label: "Deal size range" },
  ],
  general: [
    { key: "companyName", label: "Company / organization" },
    { key: "industry", label: "Industry" },
    { key: "focusArea", label: "Your focus area" },
    { key: "teamContext", label: "Team context" },
  ],
};

interface ProjectData {
  id: string;
  description: string;
  personality: string | null;
  userName: string | null;
  userRole: string | null;
  neverRules: string[];
  templateId: string;
  businessContext: Record<string, string> | null;
}

export function EditableProjectDetails({ project }: { project: ProjectData }) {
  const [data, setData] = useState(project);

  const save = async (updates: Parameters<typeof updateProject>[1]) => {
    const result = await updateProject(data.id, updates);
    if (result.error) throw new Error(result.error);
    setData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Description */}
      <DescriptionSection
        description={data.description}
        onSave={(description) => save({ description })}
      />

      {/* Personality & Owner */}
      <PersonalitySection
        personality={data.personality ?? "professional"}
        userName={data.userName ?? ""}
        userRole={data.userRole ?? ""}
        onSave={(updates) => save(updates)}
      />

      {/* Safety Rules */}
      <SafetyRulesSection
        neverRules={data.neverRules}
        onSave={(neverRules) => save({ neverRules })}
      />

      {/* Business Context */}
      <BusinessContextSection
        templateId={data.templateId}
        businessContext={(data.businessContext ?? {}) as Record<string, string>}
        onSave={(businessContext) => save({ businessContext })}
      />
    </div>
  );
}

// ── Description Section ──────────────────────────────────────────────────────

function DescriptionSection({
  description,
  onSave,
}: {
  description: string;
  onSave: (description: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await onSave(draft);
      setEditing(false);
    });
  };

  const handleCancel = () => {
    setDraft(description);
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Description</CardTitle>
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setDraft(description);
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                Mission statement
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>
            <SectionActions
              onSave={handleSave}
              onCancel={handleCancel}
              isPending={isPending}
            />
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground">Mission statement</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm">
              {description || (
                <span className="italic text-muted-foreground">Not set</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Personality & Owner Section ──────────────────────────────────────────────

function PersonalitySection({
  personality,
  userName,
  userRole,
  onSave,
}: {
  personality: string;
  userName: string;
  userRole: string;
  onSave: (updates: {
    personality?: string;
    userName?: string;
    userRole?: string;
  }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftPersonality, setDraftPersonality] = useState(personality);
  const [draftUserName, setDraftUserName] = useState(userName);
  const [draftUserRole, setDraftUserRole] = useState(userRole);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await onSave({
        personality: draftPersonality,
        userName: draftUserName,
        userRole: draftUserRole,
      });
      setEditing(false);
    });
  };

  const handleCancel = () => {
    setDraftPersonality(personality);
    setDraftUserName(userName);
    setDraftUserRole(userRole);
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Personality & Owner</CardTitle>
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setDraftPersonality(personality);
                setDraftUserName(userName);
                setDraftUserRole(userRole);
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                Personality
              </label>
              <Select
                value={draftPersonality}
                onValueChange={setDraftPersonality}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONALITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">
                  Your name
                </label>
                <Input
                  value={draftUserName}
                  onChange={(e) => setDraftUserName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">
                  Your role
                </label>
                <Input
                  value={draftUserRole}
                  onChange={(e) => setDraftUserRole(e.target.value)}
                />
              </div>
            </div>
            <SectionActions
              onSave={handleSave}
              onCancel={handleCancel}
              isPending={isPending}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Personality</p>
              <p className="mt-0.5 text-sm">
                {PERSONALITY_OPTIONS.find((o) => o.value === personality)
                  ?.label || personality}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Your name</p>
                <p className="mt-0.5 text-sm">
                  {userName || (
                    <span className="italic text-muted-foreground">
                      Not set
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Your role</p>
                <p className="mt-0.5 text-sm">
                  {userRole || (
                    <span className="italic text-muted-foreground">
                      Not set
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Safety Rules Section ─────────────────────────────────────────────────────

function SafetyRulesSection({
  neverRules,
  onSave,
}: {
  neverRules: string[];
  onSave: (neverRules: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(neverRules.join("\n"));
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const rules = draft
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);
      await onSave(rules);
      setEditing(false);
    });
  };

  const handleCancel = () => {
    setDraft(neverRules.join("\n"));
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Safety Rules</CardTitle>
            <CardDescription>
              Things your agent should never do (one per line)
            </CardDescription>
          </div>
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setDraft(neverRules.join("\n"));
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
            <SectionActions
              onSave={handleSave}
              onCancel={handleCancel}
              isPending={isPending}
            />
          </div>
        ) : (
          <div>
            {neverRules.length > 0 ? (
              <ul className="text-sm">
                {neverRules.map((rule, i) => (
                  <li key={i}>• {rule}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No safety rules set
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Business Context Section ─────────────────────────────────────────────────

function BusinessContextSection({
  templateId,
  businessContext,
  onSave,
}: {
  templateId: string;
  businessContext: Record<string, string>;
  onSave: (businessContext: Record<string, string>) => Promise<void>;
}) {
  const fields =
    BUSINESS_CONTEXT_FIELDS[templateId] ??
    BUSINESS_CONTEXT_FIELDS.general ??
    [];
  const hasBusinessContext = fields.some((f) => businessContext[f.key]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({
    ...businessContext,
  });
  const [isPending, startTransition] = useTransition();

  if (!hasBusinessContext && fields.length === 0) return null;

  const handleSave = () => {
    startTransition(async () => {
      await onSave(draft);
      setEditing(false);
    });
  };

  const handleCancel = () => {
    setDraft({ ...businessContext });
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Business Context</CardTitle>
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setDraft({ ...businessContext });
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col gap-4">
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">
                  {field.label}
                </label>
                <Input
                  value={draft[field.key] ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
            <SectionActions
              onSave={handleSave}
              onCancel={handleCancel}
              isPending={isPending}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <div key={field.key}>
                <p className="text-xs text-muted-foreground">{field.label}</p>
                <p className="mt-0.5 text-sm">
                  {businessContext[field.key] || (
                    <span className="italic text-muted-foreground">
                      Not set
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shared Save/Cancel Actions ───────────────────────────────────────────────

function SectionActions({
  onSave,
  onCancel,
  isPending,
}: {
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={onSave} disabled={isPending}>
        {isPending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Check className="mr-1 h-3 w-3" />
        )}
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onCancel}
        disabled={isPending}
      >
        <X className="mr-1 h-3 w-3" />
        Cancel
      </Button>
    </div>
  );
}
