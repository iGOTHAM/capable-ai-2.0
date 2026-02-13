"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { SkillsBoard } from "@/components/skills/skills-board";
import { PageHint } from "@/components/ui/page-hint";
import type { SkillInfo } from "@/components/skills/skills-board";

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleInstall = async (skillId: string) => {
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      });
      if (res.ok) {
        await fetchSkills();
      }
    } catch {
      // ignore
    }
  };

  const handleUninstall = async (skillId: string) => {
    try {
      await fetch(`/api/skills?id=${skillId}`, { method: "DELETE" });
      await fetchSkills();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHint
        id="hint-skills"
        title="Installable Skills"
        description="Browse and install capabilities for your agent. Each skill adds new knowledge, schedules, or behaviors."
        icon={Sparkles}
      />
      <SkillsBoard
        skills={skills}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
      />
    </div>
  );
}
