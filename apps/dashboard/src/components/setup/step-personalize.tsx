"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, User, Sparkles } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepPersonalizeProps {
  data: SetupData;
  updateData: (patch: Partial<SetupData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const WORK_TYPES = [
  { id: "pe", label: "Private Equity / Deal Analysis", description: "Due diligence, LBO modeling, IC memos" },
  { id: "research", label: "Research & Analysis", description: "Market research, competitive intel, reports" },
  { id: "assistant", label: "Executive Assistant", description: "Calendar, email, scheduling, meeting prep" },
  { id: "sales", label: "Sales & Outreach", description: "CRM, pipeline, email drafting" },
  { id: "general", label: "General Assistant", description: "Flexible, multi-purpose AI helper" },
];

const COMM_STYLES = [
  { id: "direct", label: "Direct & Concise", description: "No fluff, straight to the point" },
  { id: "balanced", label: "Balanced", description: "Professional but personable" },
  { id: "conversational", label: "Conversational", description: "Friendly and detailed" },
];

export function StepPersonalize({ data, updateData, onNext, onBack }: StepPersonalizeProps) {
  const [userName, setUserName] = useState(data.userName || "");
  const [workType, setWorkType] = useState(data.workType || "");
  const [commStyle, setCommStyle] = useState(data.commStyle || "balanced");
  const [agentName, setAgentName] = useState(data.agentName || "Atlas");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canContinue = userName.trim() && workType && commStyle;

  const handleContinue = async () => {
    if (!canContinue) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/setup/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: userName.trim(),
          workType,
          commStyle,
          agentName: agentName.trim() || "Atlas",
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to save personalization");
        setSaving(false);
        return;
      }

      // Update parent state and continue
      updateData({
        userName: userName.trim(),
        workType,
        commStyle,
        agentName: agentName.trim() || "Atlas",
      });
      onNext();
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <Sparkles className="mx-auto h-8 w-8 text-primary mb-2" />
        <p className="text-sm text-muted-foreground">
          Let&apos;s personalize your AI agent to work best for you.
        </p>
      </div>

      {/* Your Name */}
      <div className="space-y-2">
        <Label htmlFor="userName" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          What should I call you?
        </Label>
        <Input
          id="userName"
          placeholder="Your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          disabled={saving}
        />
      </div>

      {/* Work Type */}
      <div className="space-y-2">
        <Label>What kind of work will we do together?</Label>
        <Select value={workType} onValueChange={setWorkType} disabled={saving}>
          <SelectTrigger>
            <SelectValue placeholder="Select your focus area" />
          </SelectTrigger>
          <SelectContent>
            {WORK_TYPES.map((wt) => (
              <SelectItem key={wt.id} value={wt.id}>
                <div className="flex flex-col items-start">
                  <span>{wt.label}</span>
                  <span className="text-xs text-muted-foreground">{wt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Communication Style */}
      <div className="space-y-2">
        <Label>How should I communicate?</Label>
        <div className="grid gap-2">
          {COMM_STYLES.map((cs) => (
            <button
              key={cs.id}
              type="button"
              onClick={() => setCommStyle(cs.id)}
              disabled={saving}
              className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                commStyle === cs.id
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/50"
              }`}
            >
              <span className="font-medium text-sm">{cs.label}</span>
              <span className="text-xs text-muted-foreground">{cs.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Agent Name (optional) */}
      <div className="space-y-2">
        <Label htmlFor="agentName">
          Agent name <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="agentName"
          placeholder="Atlas"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          disabled={saving}
        />
        <p className="text-xs text-muted-foreground">
          Give your agent a custom name, or keep the default.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={saving} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue || saving}
          className="flex-1 gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
