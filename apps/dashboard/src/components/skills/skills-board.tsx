"use client";

import { useState } from "react";
import {
  Newspaper,
  Factory,
  Mail,
  Share2,
  Globe,
  Brain,
  Users,
  TrendingUp,
  Check,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Icon mapping ───────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Newspaper,
  Factory,
  Mail,
  Share2,
  Globe,
  Brain,
  Users,
  TrendingUp,
};

const CATEGORY_LABELS: Record<string, string> = {
  content: "Content",
  research: "Research",
  monitoring: "Monitoring",
  productivity: "Productivity",
  communication: "Communication",
};

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-500",
  green: "bg-green-500/10 text-green-500",
  orange: "bg-orange-500/10 text-orange-500",
  red: "bg-red-500/10 text-red-500",
  purple: "bg-purple-500/10 text-purple-500",
  yellow: "bg-yellow-500/10 text-yellow-500",
};

const BADGE_STYLES: Record<string, string> = {
  Official: "border-primary/30 bg-primary/10 text-primary",
  Beta: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  New: "border-green-500/30 bg-green-500/10 text-green-500",
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkillInfo {
  skill: {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    category: string;
    badge?: string;
  };
  installed: boolean;
}

interface SkillsBoardProps {
  skills: SkillInfo[];
  onInstall: (skillId: string) => Promise<void>;
  onUninstall: (skillId: string) => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SkillsBoard({ skills, onInstall, onUninstall }: SkillsBoardProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const categories = ["all", ...new Set(skills.map((s) => s.skill.category))];

  const filtered =
    filter === "all"
      ? skills
      : skills.filter((s) => s.skill.category === filter);

  const installedCount = skills.filter((s) => s.installed).length;

  const handleToggle = async (skillId: string, installed: boolean) => {
    setLoadingId(skillId);
    try {
      if (installed) {
        await onUninstall(skillId);
      } else {
        await onInstall(skillId);
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Skills</h1>
          <p className="text-sm text-muted-foreground">
            Install capabilities for your agent &middot;{" "}
            {installedCount} of {skills.length} installed
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === cat
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Skills grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(({ skill, installed }) => {
          const Icon = ICON_MAP[skill.icon] || Brain;
          const isLoading = loadingId === skill.id;
          const colorClass = COLOR_CLASSES[skill.color] || COLOR_CLASSES.blue;

          return (
            <div
              key={skill.id}
              className={`group relative rounded-xl border p-5 transition-all ${
                installed
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              {/* Installed indicator */}
              {installed && (
                <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}

              {/* Icon + meta */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{skill.name}</h3>
                    {skill.badge && (
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${BADGE_STYLES[skill.badge] || ""}`}
                      >
                        {skill.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {CATEGORY_LABELS[skill.category] || skill.category}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {skill.description}
              </p>

              {/* Install/Uninstall button */}
              <button
                onClick={() => handleToggle(skill.id, installed)}
                disabled={isLoading}
                className={`w-full rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                  installed
                    ? "border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                ) : installed ? (
                  "Uninstall"
                ) : (
                  "Install"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12">
          <p className="text-sm text-muted-foreground">
            No skills in this category yet.
          </p>
        </div>
      )}
    </div>
  );
}
