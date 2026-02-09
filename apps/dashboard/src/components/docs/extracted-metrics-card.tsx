"use client";

import { BarChart3, Plus } from "lucide-react";
import { EXTRACTED_METRICS } from "@/lib/demo-data";

interface ExtractedMetricsCardProps {
  path: string;
}

export function ExtractedMetricsCard({ path }: ExtractedMetricsCardProps) {
  // Match by filename (last segment of path)
  const fileName = path.split("/").pop() || path;
  const metrics = EXTRACTED_METRICS[fileName];

  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Extracted Metrics</span>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Plus className="h-3 w-3" />
          Add to Project
        </button>
      </div>

      {/* Metrics rows */}
      <div className="mt-3 flex flex-col">
        {metrics.map((metric, i) => (
          <div
            key={metric.label}
            className={
              i < metrics.length - 1
                ? "flex items-center justify-between border-b border-border py-2.5 text-sm"
                : "flex items-center justify-between py-2.5 text-sm"
            }
          >
            <span className="text-muted-foreground">{metric.label}</span>
            <span className="font-medium">{metric.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
