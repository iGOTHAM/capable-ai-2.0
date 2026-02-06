import {
  SOUL_TEMPLATES,
  AGENTS_TEMPLATE,
  MEMORY_TEMPLATES,
  KNOWLEDGE_TEMPLATES,
  DEFAULT_CONFIG_PATCH,
  PERSONALITY_TONES,
  type TemplateId,
  type PersonalityTone,
} from "@capable-ai/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeneratePackInput {
  templateId: TemplateId;
  mode: "DRAFT_ONLY" | "ASK_FIRST";
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

// ─── Pack Generation ────────────────────────────────────────────────────────

export function generatePackFiles(input: GeneratePackInput): Record<string, string> {
  const {
    templateId,
    mode,
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
    // Flatten business context into top-level vars
    ...(businessContext || {}),
    // Flag for conditional context block
    hasContext: businessContext
      ? String(Object.values(businessContext).some((v) => v && v.trim() !== ""))
      : "",
  };

  // ─── SOUL.md ──────────────────────────────────────────────────────────────

  let soulMd = interpolate(SOUL_TEMPLATES[templateId], ctx);

  // Append personality tone
  if (personality && PERSONALITY_TONES[personality]) {
    soulMd += `\n\n## Personality & Tone\n${PERSONALITY_TONES[personality].soulFragment}`;
  }

  // ─── AGENTS.md ────────────────────────────────────────────────────────────

  const agentsCtx: Record<string, string | boolean | undefined> = {
    modeName: mode === "ASK_FIRST" ? "Do It — Ask Me First" : "Draft Only",
    askFirst: mode === "ASK_FIRST" ? "true" : "",
  };

  let agentsMd = interpolate(AGENTS_TEMPLATE, agentsCtx);

  // Append never rules
  if (neverRules.length > 0) {
    agentsMd += `\n\n## Never Rules\nThese are absolute prohibitions:\n${neverRules.map((r) => `- ${r}`).join("\n")}`;
  }

  // ─── MEMORY.md ────────────────────────────────────────────────────────────

  const memoryMd = interpolate(MEMORY_TEMPLATES[templateId], ctx);

  // ─── Knowledge files ──────────────────────────────────────────────────────

  const knowledge = KNOWLEDGE_TEMPLATES[templateId];

  // ─── Bootstrap events ─────────────────────────────────────────────────────

  const agentLabel = botName || "your agent";
  const bootstrapEvents = [
    JSON.stringify({
      ts: now,
      runId: "bootstrap",
      type: "bootstrap.completed",
      summary: "Capable Pack applied successfully. Dashboard started.",
      details: { packVersion: 1, template: templateId, mode },
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

  // ─── today.md ─────────────────────────────────────────────────────────────

  const todayMd = `# Today — ${dateStr}

## Status
Pack deployed. Awaiting first interaction.

## What Changed
- Capable Pack v1 applied
- Dashboard started
- Bootstrap events logged

## Pending
- User to provide initial context and preferences
- Review reverse prompts in Chat

## Remember
- This is a fresh deployment. Memory will build over time.`;

  // ─── Assemble files ───────────────────────────────────────────────────────

  const files: Record<string, string> = {
    "SOUL.md": soulMd,
    "AGENTS.md": agentsMd,
    "MEMORY.md": memoryMd,
    [knowledge.filename]: knowledge.content,
    "activity/events.ndjson": bootstrapEvents,
    "activity/today.md": todayMd,
    "configPatch.json": JSON.stringify(DEFAULT_CONFIG_PATCH, null, 2),
  };

  // Add custom knowledge files
  if (customKnowledge && customKnowledge.length > 0) {
    for (const file of customKnowledge) {
      // Sanitize filename: lowercase, alphanumeric + hyphens + dots + underscores
      const safeName = file.filename
        .replace(/[^a-z0-9-_.]/gi, "-")
        .toLowerCase();
      files[`knowledge/${safeName}`] = file.content;
    }
  }

  return files;
}
