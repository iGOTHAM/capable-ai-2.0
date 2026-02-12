"use client";

import { ExternalLink, Mail, Calendar, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/icons/google";

const REFERRAL_URL =
  "https://c.gle/AHvOEDkdrN2j0E3O3mN3i7Hh1a6_fa-XGld1Xw2kP2Uc3I0odt1SJrp1_pnJFPaH0r09CabyE3NC2RVEsv0_Lklee1JipFnT5rXDnHtUzCsu268vzj4vhZR9SyN7BRFtdcPr1a2mxx7HynWPcnOjzBsB";

const BENEFITS = [
  { icon: Mail, label: "Email" },
  { icon: Calendar, label: "Calendar" },
  { icon: FolderOpen, label: "Drive" },
] as const;

export function GoogleWorkspaceCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <GoogleIcon className="h-4 w-4" />
        <span className="text-lg font-semibold">Google Workspace</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Give your agent a dedicated workspace with professional tools
      </p>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {BENEFITS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-muted/50 p-3 text-center"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          );
        })}
      </div>

      <Button asChild variant="outline" className="gap-2">
        <a href={REFERRAL_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          Set Up Google Workspace
        </a>
      </Button>
    </div>
  );
}
