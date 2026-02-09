"use client";

import { Sparkles, RefreshCw } from "lucide-react";
import { AI_SUMMARIES } from "@/lib/demo-data";

interface AiSummaryCardProps {
  path: string;
}

export function AiSummaryCard({ path }: AiSummaryCardProps) {
  // Match by filename (last segment of path)
  const fileName = path.split("/").pop() || path;
  const summary = AI_SUMMARIES[fileName];

  if (!summary) return null;

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-purple-500/[0.08] to-blue-500/5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-blue-400">
            AI Summary
          </span>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </button>
      </div>

      {/* Key points */}
      <ul className="mt-3 flex flex-col gap-2">
        {summary.keyPoints.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className={
                point.flagged
                  ? "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  : "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
              }
            />
            <span
              className={
                point.flagged
                  ? "text-amber-400"
                  : "text-muted-foreground"
              }
            >
              {point.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
