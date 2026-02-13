"use client";

import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHintProps {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function PageHint({ id, title, description, icon: Icon }: PageHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if not previously dismissed
    if (typeof window !== "undefined" && localStorage.getItem(id) !== "dismissed") {
      setVisible(true);
    }
  }, [id]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(id, "dismissed");
    setVisible(false);
  };

  const IconComponent = Icon || Info;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-blue-500/10 bg-blue-500/5 px-4 py-3 transition-opacity",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
        <IconComponent className="h-4 w-4 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-blue-500/10 hover:text-foreground"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
