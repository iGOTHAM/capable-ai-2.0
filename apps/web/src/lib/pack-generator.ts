import {
  SOUL_TEMPLATES,
  AGENTS_TEMPLATE,
  MEMORY_TEMPLATES,
  KNOWLEDGE_TEMPLATES,
  DEFAULT_CONFIG_PATCH,
  PERSONALITY_TONES,
  USER_TEMPLATES,
  DIRECTIVES_TEMPLATE,
  LESSONS_TEMPLATE,
  PROACTIVE_WORKFLOWS,
  ACTIVE_CONTEXT_TEMPLATE,
  RUNBOOKS_README_TEMPLATE,
  type TemplateId,
  type PersonalityTone,
} from "@capable-ai/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeneratePackInput {
  templateId: TemplateId;
  description: string;
  neverRules: string[];
  botName?: string;
  userName?: string;
  userRole?: string;
  personality?: PersonalityTone;
  businessContext?: Record<string, string>;
  customKnowledge?: { filename: string; content: string }[];
}

// ─── Template Interpolation ─────────────────────────────────────────────────
// Simple Handlebars-like engine: {{var}}, {{#if var}}...{{/if}}, {{#if var}}...{{else}}...{{/if}}
// No dependencies — just regex.

function interpolate(template: string, vars: Record<string, string | boolean | undefined>): string {
  let result = template;

  // Process {{#if var}}...{{else}}...{{/if}} blocks (with else)
  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, ifContent, elseContent) => {
      const val = vars[key];
      return val && val !== "" ? ifContent : elseContent;
    },
  );

  // Process {{#if var}}...{{/if}} blocks (without else)
  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => {
      const val = vars[key];
      return val && val !== "" ? content : "";
    },
  );

  // Process {{var}} substitutions
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    if (val === undefined || val === "" || val === true || val === false) return "";
    return String(val);
  });

  // Clean up: remove lines that are ONLY whitespace after interpolation
  // (from conditional blocks that resolved to empty)
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

// ─── Knowledge File Descriptions ────────────────────────────────────────────
// Human-readable descriptions for the knowledge catalog in MEMORY.md

const KNOWLEDGE_DESCRIPTIONS: Partial<Record<TemplateId, string>> = {
  pe: "PE frameworks, First Look memo template, QoE red flags, diligence checklists, pipeline stages",
  realestate: "RE investment memo template, due diligence checklist, key formulas (Cap Rate, NOI, DSCR, GRM), property type primers",
  general: "Research framework, analysis templates (SWOT, cost-benefit, decision matrix, risk assessment), writing templates",
};

// ─── Pack Generation ────────────────────────────────────────────────────────

export function generatePackFiles(input: GeneratePackInput): Record<string, string> {
  const {
    templateId,
    description,
    neverRules,
    botName,
    userName,
    userRole,
    personality,
    businessContext,
    customKnowledge,
  } = input;
  const now = new Date().toISOString();
  const dateStr = new Date().toISOString().split("T")[0];

  // Build variable context for interpolation
  const ctx: Record<string, string | boolean | undefined> = {
    botName: botName || "Capable",
    userName,
    userRole,
    description: description || "",
    dateStr,
    // Flatten business context into top-level vars
    ...(businessContext || {}),
    // Flag for conditional context block — empty string means false for {{#if}}
    hasContext:
      businessContext &&
      Object.keys(businessContext).length > 0 &&
      Object.values(businessContext).some((v) => v && v.trim() !== "")
        ? "true"
        : "",
  };

  // ─── SOUL.md ──────────────────────────────────────────────────────────────

  let soulMd = interpolate(SOUL_TEMPLATES[templateId], ctx);

  // Append personality tone
  if (personality && PERSONALITY_TONES[personality]) {
    soulMd += `\n\n## Personality & Tone\n${PERSONALITY_TONES[personality].soulFragment}`;
  }

  // ─── AGENTS.md ────────────────────────────────────────────────────────────

  let agentsMd = AGENTS_TEMPLATE;

  // Append never rules
  if (neverRules.length > 0) {
    agentsMd += `\n\n## Never Rules\nThese are absolute prohibitions:\n${neverRules.map((r) => `- ${r}`).join("\n")}`;
  }

  // ─── USER.md ──────────────────────────────────────────────────────────────

  let userMd = interpolate(USER_TEMPLATES[templateId], ctx);

  // Append personality description if available
  if (personality && PERSONALITY_TONES[personality]) {
    userMd = userMd.replace(
      "*(Communication style, timezone, preferred formats — learn through conversation)*",
      `${PERSONALITY_TONES[personality].soulFragment}\n- *(Timezone, preferred formats — learn through conversation)*`,
    );
  }

  // ─── MEMORY.md ────────────────────────────────────────────────────────────

  let memoryMd = interpolate(MEMORY_TEMPLATES[templateId], ctx);

  // ─── Knowledge files ──────────────────────────────────────────────────────

  const knowledge = KNOWLEDGE_TEMPLATES[templateId];

  // Build knowledge catalog for MEMORY.md
  const knowledgeEntries: { path: string; description: string }[] = [];
  if (knowledge) {
    knowledgeEntries.push({
      path: knowledge.filename,
      description: KNOWLEDGE_DESCRIPTIONS[templateId] ?? "Domain knowledge",
    });
  }

  // Add custom knowledge files
  const customKnowledgeFiles: Record<string, string> = {};
  if (customKnowledge && customKnowledge.length > 0) {
    for (const file of customKnowledge) {
      const safeName = file.filename
        .replace(/[^a-z0-9-_.]/gi, "-")
        .toLowerCase();
      customKnowledgeFiles[`knowledge/${safeName}`] = file.content;
      knowledgeEntries.push({
        path: `knowledge/${safeName}`,
        description: `User-uploaded: ${file.filename} (~${Math.round(file.content.length / 1024)}KB)`,
      });
    }
  }

  // Append knowledge catalog to MEMORY.md
  if (knowledgeEntries.length > 0) {
    memoryMd += `\n\n## Knowledge Files\n| File | Description |\n|------|-------------|\n`;
    for (const entry of knowledgeEntries) {
      memoryMd += `| ${entry.path} | ${entry.description} |\n`;
    }
  }

  // Append proactive workflows to MEMORY.md
  memoryMd += `\n\n${PROACTIVE_WORKFLOWS[templateId]}`;

  // ─── memory/directives.md ─────────────────────────────────────────────────

  const directivesMd = DIRECTIVES_TEMPLATE;

  // ─── memory/YYYY-MM-DD.md (daily log) ──────────────────────────────────────

  const dailyLogMd = `# Daily Log — ${dateStr}

## Status
Pack deployed. Awaiting first interaction.

## What Changed
- Capable Pack v1 applied
- Agent deployed and configured
- Bootstrap events logged

## Pending
- Complete onboarding: read knowledge files, set up cron jobs
- First conversation with user

## Notes
- This is a fresh deployment. Memory will build over time.
- Review knowledge/ directory for domain-specific frameworks.`;

  // ─── memory/lessons-learned.md ─────────────────────────────────────────────

  const lessonsLearnedMd = LESSONS_TEMPLATE;

  // ─── tasks.json ────────────────────────────────────────────────────────────

  const tasksJson = JSON.stringify({
    tasks: [
      {
        id: "onboard-001",
        title: "Get to know the user — ask about goals, workflows, preferences",
        status: "pending",
        priority: "high",
        created: dateStr,
        context: "First interaction. Learn about the user to be more effective.",
      },
      {
        id: "onboard-002",
        title: "Read all knowledge files and summarize frameworks in MEMORY.md",
        status: "pending",
        priority: "high",
        created: dateStr,
        context: "Knowledge files are in knowledge/ — read and internalize them.",
      },
      {
        id: "onboard-003",
        title: "Set up recommended proactive workflows using cron",
        status: "pending",
        priority: "medium",
        created: dateStr,
        context: "See 'Suggested Proactive Workflows' in MEMORY.md.",
      },
    ],
    completed: [],
  }, null, 2);

  // ─── Bootstrap events ─────────────────────────────────────────────────────

  const agentLabel = botName || "your agent";
  const bootstrapEvents = [
    JSON.stringify({
      ts: now,
      runId: "bootstrap",
      type: "bootstrap.completed",
      summary: "Capable Pack applied successfully. Dashboard started.",
      details: { packVersion: 1, template: templateId },
    }),
    JSON.stringify({
      ts: now,
      runId: "bootstrap",
      type: "chat.bot_message",
      summary:
        "Based on what you know about me and my goals, what are some tasks you can do to get us closer to our missions?",
      details: { source: "reverse_prompt", promptIndex: 1 },
    }),
    JSON.stringify({
      ts: now,
      runId: "bootstrap",
      type: "chat.bot_message",
      summary: `What other information can I provide ${agentLabel} to improve our productivity?`,
      details: { source: "reverse_prompt", promptIndex: 2 },
    }),
  ].join("\n");

  // ─── Assemble files ───────────────────────────────────────────────────────

  const files: Record<string, string> = {
    "SOUL.md": soulMd,
    "AGENTS.md": agentsMd,
    "MEMORY.md": memoryMd,
    "USER.md": userMd,
    ...(knowledge ? { [knowledge.filename]: knowledge.content } : {}),
    "memory/directives.md": directivesMd,
    "memory/active-context.md": ACTIVE_CONTEXT_TEMPLATE,
    "memory/runbooks/README.md": RUNBOOKS_README_TEMPLATE,
    [`memory/${dateStr}.md`]: dailyLogMd,
    "memory/lessons-learned.md": lessonsLearnedMd,
    "tasks.json": tasksJson,
    "activity/events.ndjson": bootstrapEvents,
    "configPatch.json": JSON.stringify(DEFAULT_CONFIG_PATCH, null, 2),
    // Add custom knowledge files
    ...customKnowledgeFiles,
  };

  return files;
}
