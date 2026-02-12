"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  Calendar,
  FolderOpen,
} from "lucide-react";
import { GoogleIcon } from "@/components/icons/google";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepWorkspaceProps {
  data: SetupData;
  onNext: () => void;
  onBack: () => void;
}

const REFERRAL_URL =
  "https://c.gle/AHvOEDkdrN2j0E3O3mN3i7Hh1a6_fa-XGld1Xw2kP2Uc3I0odt1SJrp1_pnJFPaH0r09CabyE3NC2RVEsv0_Lklee1JipFnT5rXDnHtUzCsu268vzj4vhZR9SyN7BRFtdcPr1a2mxx7HynWPcnOjzBsB";

const BENEFITS = [
  {
    icon: Mail,
    title: "Dedicated Email",
    description:
      "A professional email address for your agent to send and receive",
  },
  {
    icon: Calendar,
    title: "Calendar Access",
    description: "Schedule meetings and manage events on your behalf",
  },
  {
    icon: FolderOpen,
    title: "Google Drive Storage",
    description: "Store and organize files, documents, and reports",
  },
] as const;

export function StepWorkspace({ data, onNext, onBack }: StepWorkspaceProps) {
  const agentName = data.agentName || "your agent";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <GoogleIcon className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground">
          Give{" "}
          <span className="font-medium text-foreground">{agentName}</span> a
          workspace with email, calendar, and storage.
        </p>
      </div>

      {/* Benefits */}
      <div className="space-y-3">
        {BENEFITS.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <div
              key={benefit.title}
              className="flex items-start gap-3 rounded-lg border border-input p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Icon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium">{benefit.title}</div>
                <div className="text-xs text-muted-foreground">
                  {benefit.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendation note */}
      <p className="text-center text-xs text-muted-foreground">
        We recommend Google Workspace for the best agent experience. This is
        optional &mdash; you can set it up later from Settings.
      </p>

      {/* CTA + navigation */}
      <div className="flex flex-col gap-3">
        <Button asChild variant="outline" className="gap-2">
          <a href={REFERRAL_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Set Up Google Workspace
          </a>
        </Button>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button onClick={onNext} className="flex-1">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
