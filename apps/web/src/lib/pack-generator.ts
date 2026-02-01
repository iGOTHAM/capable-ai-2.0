import {
  SOUL_TEMPLATES,
  AGENTS_DRAFT_ONLY,
  AGENTS_ASK_FIRST,
  MEMORY_SCAFFOLD,
  KNOWLEDGE_TEMPLATES,
  DEFAULT_CONFIG_PATCH,
  type TemplateId,
} from "@capable-ai/shared";

interface GeneratePackInput {
  templateId: TemplateId;
  mode: "DRAFT_ONLY" | "ASK_FIRST";
  description: string;
  neverRules: string[];
}

export function generatePackFiles(input: GeneratePackInput): Record<string, string> {
  const { templateId, mode, description, neverRules } = input;
  const now = new Date().toISOString();
  const dateStr = new Date().toISOString().split("T")[0];

  // SOUL.md — base template + user description
  let soulMd = SOUL_TEMPLATES[templateId];
  if (description) {
    soulMd += `\n\n## User Context\n${description}`;
  }

  // AGENTS.md — based on mode + never rules
  let agentsMd = mode === "DRAFT_ONLY" ? AGENTS_DRAFT_ONLY : AGENTS_ASK_FIRST;
  if (neverRules.length > 0) {
    agentsMd += `\n\n## Never Rules\nThe following actions are strictly prohibited:\n${neverRules.map((r) => `- ${r}`).join("\n")}`;
  }

  // Knowledge file
  const knowledge = KNOWLEDGE_TEMPLATES[templateId];

  // Bootstrap events
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
      summary:
        "What other information can I provide you to improve our productivity",
      details: { source: "reverse_prompt", promptIndex: 2 },
    }),
  ].join("\n");

  // today.md
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

  const files: Record<string, string> = {
    "SOUL.md": soulMd,
    "AGENTS.md": agentsMd,
    "MEMORY.md": MEMORY_SCAFFOLD,
    [knowledge.filename]: knowledge.content,
    "activity/events.ndjson": bootstrapEvents,
    "activity/today.md": todayMd,
    "configPatch.json": JSON.stringify(DEFAULT_CONFIG_PATCH, null, 2),
  };

  return files;
}
