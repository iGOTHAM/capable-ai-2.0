"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
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
  legal: [
    { key: "firmName", label: "Firm / practice name" },
    { key: "practiceAreas", label: "Primary practice areas" },
    { key: "jurisdictions", label: "Jurisdictions" },
    { key: "clientTypes", label: "Client types" },
  ],
  healthcare: [
    { key: "organizationName", label: "Organization name" },
    { key: "organizationType", label: "Organization type" },
    { key: "specialtyFocus", label: "Specialty focus" },
    { key: "patientPopulation", label: "Patient population" },
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

function EditableField({
  label,
  value,
  onSave,
  type = "text",
  options,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  type?: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await onSave(draft);
      setEditing(false);
    });
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-sm whitespace-pre-wrap">
            {value || <span className="italic text-muted-foreground">Not set</span>}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {type === "select" && options ? (
        <Select value={draft} onValueChange={setDraft}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === "textarea" ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      ) : (
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} />
      )}
      <div className="flex gap-1">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
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
          onClick={handleCancel}
          disabled={isPending}
        >
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EditableProjectDetails({ project }: { project: ProjectData }) {
  const [data, setData] = useState(project);
  const bc = (data.businessContext ?? {}) as Record<string, string>;
  const fields = BUSINESS_CONTEXT_FIELDS[data.templateId] ?? BUSINESS_CONTEXT_FIELDS.general ?? [];
  const hasBusinessContext = fields.some((f) => bc[f.key]);

  const save = async (
    updates: Parameters<typeof updateProject>[1],
  ) => {
    const result = await updateProject(data.id, updates);
    if (result.error) throw new Error(result.error);
    setData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Description */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <EditableField
            label="Mission statement"
            value={data.description}
            type="textarea"
            onSave={async (v) => save({ description: v })}
          />
        </CardContent>
      </Card>

      {/* Personality & Owner */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Personality & Owner</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EditableField
            label="Personality"
            value={data.personality ?? "professional"}
            type="select"
            options={[...PERSONALITY_OPTIONS]}
            onSave={async (v) => save({ personality: v })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <EditableField
              label="Your name"
              value={data.userName ?? ""}
              onSave={async (v) => save({ userName: v })}
            />
            <EditableField
              label="Your role"
              value={data.userRole ?? ""}
              onSave={async (v) => save({ userRole: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Safety Rules */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Safety Rules</CardTitle>
          <CardDescription>
            Things your agent should never do (one per line)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditableField
            label="Never rules"
            value={data.neverRules.join("\n")}
            type="textarea"
            onSave={async (v) =>
              save({
                neverRules: v
                  .split("\n")
                  .map((r) => r.trim())
                  .filter(Boolean),
              })
            }
          />
        </CardContent>
      </Card>

      {/* Business Context */}
      {(hasBusinessContext || fields.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Business Context</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {fields.map((field) => (
              <EditableField
                key={field.key}
                label={field.label}
                value={bc[field.key] ?? ""}
                onSave={async (v) =>
                  save({
                    businessContext: { ...bc, [field.key]: v },
                  })
                }
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
