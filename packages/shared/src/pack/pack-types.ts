export type TemplateId = "pe" | "legal" | "healthcare" | "general";

export type PersonalityTone = "professional" | "casual" | "direct" | "friendly";

export interface PackManifest {
  projectId: string;
  version: number;
  templateId: TemplateId;
  createdAt: string;
  files: string[];
}

export interface PackFiles {
  "SOUL.md": string;
  "AGENTS.md": string;
  "MEMORY.md": string;
  [knowledgePath: `knowledge/${string}.md`]: string;
  "activity/events.ndjson": string;
  "activity/today.md": string;
  "configPatch.json": string;
}

export interface ConfigPatch {
  compaction: {
    memoryFlush: {
      enabled: boolean;
    };
  };
  memorySearch: {
    experimental: {
      sessionMemory: boolean;
    };
    sources: string[];
  };
}

export const DEFAULT_CONFIG_PATCH: ConfigPatch = {
  compaction: {
    memoryFlush: {
      enabled: true,
    },
  },
  memorySearch: {
    experimental: {
      sessionMemory: true,
    },
    sources: ["memory", "sessions"],
  },
};

export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  pe: "Private Equity",
  legal: "Legal",
  healthcare: "Healthcare",
  general: "General",
};

