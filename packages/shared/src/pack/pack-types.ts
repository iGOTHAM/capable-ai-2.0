export type TemplateId = "pe" | "realestate" | "general";

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
  "USER.md": string;
  "memory/directives.md": string;
  "memory/lessons-learned.md": string;
  "tasks.json": string;
  [knowledgePath: `knowledge/${string}.md`]: string;
  [memoryPath: `memory/${string}.md`]: string;
  "activity/events.ndjson": string;
  "configPatch.json": string;
}

// ConfigPatch is reserved for future OpenClaw config overrides.
// OpenClaw v2026.2.x validates its config strictly — only known keys are allowed.
// The keys we originally wanted (compaction, memorySearch) are not recognized.
// When OpenClaw adds support for these features, we can add them back here.
export interface ConfigPatch {
  [key: string]: unknown;
}

export const DEFAULT_CONFIG_PATCH: ConfigPatch = {};

export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  pe: "Private Equity",
  realestate: "Real Estate",
  general: "General",
};

export const DEFAULT_PACK_CONFIGS: Record<
  TemplateId,
  { personality: PersonalityTone; description: string; neverRules: string[] }
> = {
  pe: {
    personality: "professional",
    description:
      "A PE senior associate that screens inbound deals, produces First Look memos, tracks pipeline, and supports due diligence workstreams.",
    neverRules: [
      "Never fabricate financial data or metrics",
      "Never send external communications without approval",
    ],
  },
  realestate: {
    personality: "professional",
    description:
      "A real estate analyst that evaluates property deals, tracks transactions, manages deal pipeline, and produces investment memos.",
    neverRules: [
      "Never fabricate property valuations or market data",
      "Never send external communications without approval",
    ],
  },
  general: {
    personality: "professional",
    description:
      "A versatile assistant that researches topics, drafts documents, tracks projects, and supports day-to-day workflows.",
    neverRules: [
      "Never fabricate data or citations",
      "Never send external communications without approval",
    ],
  },
};

