import { readConfig, writeConfig, getEnabledSkills, setEnabledSkills } from "./openclaw";
import { writeDoc, deleteDoc } from "./docs";
import { createScheduledTask, readSchedules, deleteScheduledTask } from "./schedules";
import type { ScheduledTask } from "./schedules";

// ─── Skill Definition ───────────────────────────────────────────────────────

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  color: string;
  category: "content" | "research" | "monitoring" | "productivity" | "communication";
  badge?: "Official" | "Beta" | "New";
  // What happens on install:
  knowledgeFile?: { path: string; content: string };
  directive?: string;
  schedule?: Omit<ScheduledTask, "id" | "createdAt">;
}

export interface InstalledSkillInfo {
  skill: SkillDefinition;
  installed: boolean;
}

// ─── Skill Registry (curated v1) ────────────────────────────────────────────

export const SKILL_REGISTRY: SkillDefinition[] = [
  {
    id: "daily-briefing",
    name: "Daily Briefing",
    description: "Morning summary of tasks, calendar events, and news. Runs every morning at your configured time.",
    icon: "Newspaper",
    color: "blue",
    category: "productivity",
    badge: "Official",
    knowledgeFile: {
      path: "knowledge/daily-briefing.md",
      content: `# Daily Briefing Skill

## Purpose
Generate a morning briefing that helps the user start their day informed.

## What to Include
1. **Task Summary**: Read TASKS.md and summarize what's pending, in-progress, and recently completed
2. **Calendar**: Check schedules.json for today's scheduled tasks
3. **Key Metrics**: Any notable changes in recent activity events

## Output
Write the briefing to memory/{date}.md as a "Daily Briefing" section.
Also send a summary via the messaging channel if available.

## Tone
Professional but warm. Focus on actionable items. Keep it concise.
`,
    },
    schedule: {
      name: "Daily Briefing",
      color: "blue",
      type: "recurring",
      schedule: { frequency: "daily", time: "08:00", days: [1, 2, 3, 4, 5] },
      enabled: true,
    },
  },
  {
    id: "content-factory",
    name: "Content Factory",
    description: "Research trending topics and produce scripts, newsletters, and social content on a regular schedule.",
    icon: "Factory",
    color: "orange",
    category: "content",
    badge: "Official",
    knowledgeFile: {
      path: "knowledge/content-factory.md",
      content: `# Content Factory Skill

## Purpose
Produce content assets on a regular schedule based on user-defined topics and formats.

## Workflow
1. **Research**: Use web_search to find trending topics in the user's niche
2. **Outline**: Create a content outline with key points and hooks
3. **Draft**: Write the full content piece (script, newsletter, post)
4. **Store**: Save to the appropriate workspace folder (scripts/, newsletters/, social/)

## Content Types
- **YouTube Scripts**: Long-form video scripts with hooks, segments, and CTAs
- **Newsletters**: Email newsletters with curated insights and commentary
- **Social Posts**: Short-form posts for Twitter/LinkedIn/etc.

## Schedule
Run weekly or as configured. Check existing content to avoid duplicates.
`,
    },
    schedule: {
      name: "Content Factory",
      color: "orange",
      type: "recurring",
      schedule: { frequency: "weekly", time: "10:00", days: [1, 3] },
      enabled: true,
    },
  },
  {
    id: "newsletter-writer",
    name: "Newsletter Writer",
    description: "Weekly newsletter from curated sources. Researches, drafts, and saves a ready-to-send newsletter.",
    icon: "Mail",
    color: "green",
    category: "content",
    badge: "New",
    knowledgeFile: {
      path: "knowledge/newsletter-writer.md",
      content: `# Newsletter Writer Skill

## Purpose
Produce a weekly newsletter that curates and synthesizes information from specified sources.

## Workflow
1. Research recent developments using web_search
2. Curate the top 5-7 most interesting stories/insights
3. Write commentary and analysis for each item
4. Format as a newsletter with intro, sections, and sign-off
5. Save to newsletters/ folder with date in filename

## Style
Conversational but informative. Add personal commentary. Include links to sources.
`,
    },
    schedule: {
      name: "Newsletter Writer",
      color: "green",
      type: "recurring",
      schedule: { frequency: "weekly", time: "09:00", days: [5] },
      enabled: true,
    },
  },
  {
    id: "social-media",
    name: "Social Media Manager",
    description: "Draft tweets, threads, and LinkedIn posts from recent work and content. Saves drafts for your review.",
    icon: "Share2",
    color: "purple",
    category: "content",
    directive: "When creating social media content, always save drafts to social/ folder for user review before any posting. Never post automatically.",
    knowledgeFile: {
      path: "knowledge/social-media.md",
      content: `# Social Media Manager Skill

## Purpose
Create social media content based on the user's recent work, content, and insights.

## Content Types
- **Tweets**: Single tweets (< 280 chars) with hooks
- **Threads**: Multi-tweet threads that tell a story or explain a concept
- **LinkedIn Posts**: Professional insights and commentary

## Rules
- ALWAYS save to social/ folder as drafts
- NEVER post automatically — user must review and approve
- Include suggested hashtags and posting times
- Reference the user's actual work and content, not generic advice
`,
    },
    schedule: {
      name: "Social Media Drafts",
      color: "purple",
      type: "recurring",
      schedule: { frequency: "weekly", time: "11:00", days: [2, 4] },
      enabled: true,
    },
  },
  {
    id: "web-monitor",
    name: "Web Monitor",
    description: "Watch URLs for changes and alert you when something important happens. Great for competitor tracking.",
    icon: "Globe",
    color: "red",
    category: "monitoring",
    badge: "Beta",
    knowledgeFile: {
      path: "knowledge/web-monitor.md",
      content: `# Web Monitor Skill

## Purpose
Periodically check specified URLs for changes and report notable differences.

## Setup
The user should create a file at workspace/watchlist.json with URLs to monitor:
\`\`\`json
{
  "urls": [
    { "url": "https://example.com", "label": "Competitor Homepage", "checkInterval": "daily" }
  ]
}
\`\`\`

## Workflow
1. Read watchlist.json for URLs to check
2. Fetch each URL using web_fetch
3. Compare with previous snapshot (stored in workspace/snapshots/)
4. If changes detected, write a summary to memory/YYYY-MM-DD.md
5. Send alert via messaging channel if significant changes found

## What Counts as Significant
- New products/features announced
- Pricing changes
- Blog posts or news updates
- Status page changes
`,
    },
    schedule: {
      name: "Web Monitor",
      color: "red",
      type: "recurring",
      schedule: { frequency: "daily", time: "07:00", days: [0, 1, 2, 3, 4, 5, 6] },
      enabled: true,
    },
  },
  {
    id: "memory-consolidation",
    name: "Memory Consolidation",
    description: "Weekly review of daily logs to update long-term memory. Keeps MEMORY.md current and useful.",
    icon: "Brain",
    color: "purple",
    category: "productivity",
    badge: "Official",
    knowledgeFile: {
      path: "knowledge/memory-consolidation.md",
      content: `# Memory Consolidation Skill

## Purpose
Review recent daily journal entries and conversations to extract lasting insights for long-term memory.

## Workflow
1. Read all journal entries from the past week (memory/YYYY-MM-DD.md files)
2. Identify recurring themes, lessons learned, and important decisions
3. Update MEMORY.md with new insights, removing outdated information
4. Write a weekly summary entry

## What to Consolidate
- Patterns in user behavior or preferences
- Lessons from completed tasks or projects
- Important decisions and their reasoning
- User preferences and working style observations
- Technical knowledge gained

## Rules
- Never delete information without good reason
- Mark uncertain observations as tentative
- Keep MEMORY.md well-organized with clear sections
`,
    },
    schedule: {
      name: "Memory Consolidation",
      color: "purple",
      type: "recurring",
      schedule: { frequency: "weekly", time: "22:00", days: [0] },
      enabled: true,
    },
  },
  {
    id: "meeting-prep",
    name: "Meeting Prep",
    description: "Research attendees and prepare briefing materials before your calendar events.",
    icon: "Users",
    color: "blue",
    category: "productivity",
    knowledgeFile: {
      path: "knowledge/meeting-prep.md",
      content: `# Meeting Prep Skill

## Purpose
Prepare briefing materials before scheduled meetings or events.

## Workflow
1. Check calendar/schedules for upcoming events
2. For each event with attendees listed:
   - Research attendees using web_search (LinkedIn, company pages)
   - Compile a brief on each person (role, background, recent activity)
   - Note any shared connections or interests
3. Prepare talking points based on the meeting topic
4. Save briefing to workspace/meeting-prep/ folder

## Output Format
- One file per meeting: meeting-prep/YYYY-MM-DD-{meeting-name}.md
- Include: attendee bios, talking points, open questions, follow-up items
`,
    },
  },
  {
    id: "deal-screener",
    name: "Deal Screener",
    description: "Monitor deal sources for new opportunities. Screens and summarizes new deals matching your criteria.",
    icon: "TrendingUp",
    color: "green",
    category: "research",
    knowledgeFile: {
      path: "knowledge/deal-screener.md",
      content: `# Deal Screener Skill

## Purpose
Monitor configured sources for new investment or business opportunities.

## Setup
Create workspace/deal-criteria.json with your screening criteria:
\`\`\`json
{
  "sectors": ["SaaS", "AI/ML", "FinTech"],
  "revenueMin": 1000000,
  "geography": ["US", "EU"],
  "sources": ["specific URLs or search terms"]
}
\`\`\`

## Workflow
1. Read deal-criteria.json for screening parameters
2. Search configured sources using web_search
3. For each potential deal, extract key metrics
4. Score against criteria
5. Save qualified deals to workspace/deals/ folder
6. Alert user of high-priority matches
`,
    },
    schedule: {
      name: "Deal Screener",
      color: "green",
      type: "recurring",
      schedule: { frequency: "daily", time: "06:00", days: [1, 2, 3, 4, 5] },
      enabled: true,
    },
  },
];

// ─── Install / Uninstall ────────────────────────────────────────────────────

export async function getInstalledSkills(): Promise<InstalledSkillInfo[]> {
  const enabledIds = await getEnabledSkills();
  return SKILL_REGISTRY.map((skill) => ({
    skill,
    installed: enabledIds.includes(skill.id),
  }));
}

export async function installSkill(skillId: string): Promise<boolean> {
  const skill = SKILL_REGISTRY.find((s) => s.id === skillId);
  if (!skill) return false;

  // 1. Enable in openclaw.json skills list
  const enabled = await getEnabledSkills();
  if (!enabled.includes(skillId)) {
    enabled.push(skillId);
  }
  const config = await readConfig();
  const disabled = config?.skills?.disabled?.filter((d) => d !== skillId) || [];
  await setEnabledSkills(enabled, disabled);

  // 2. Write knowledge file if provided
  if (skill.knowledgeFile) {
    await writeDoc(skill.knowledgeFile.path, skill.knowledgeFile.content);
  }

  // 3. Append directive if provided
  if (skill.directive) {
    try {
      const { readDoc } = await import("./docs");
      const result = await readDoc("directives.md");
      const existing = result?.content || "# Directives\n";
      const marker = `<!-- skill:${skillId} -->`;
      if (!existing.includes(marker)) {
        const updated = existing.trimEnd() + `\n\n${marker}\n## ${skill.name}\n${skill.directive}\n<!-- /skill:${skillId} -->\n`;
        await writeDoc("directives.md", updated);
      }
    } catch {
      // Non-critical
    }
  }

  // 4. Create schedule if provided
  if (skill.schedule) {
    const schedules = await readSchedules();
    const existing = schedules.tasks.find((t) => t.name === skill.schedule!.name);
    if (!existing) {
      await createScheduledTask(skill.schedule);
    }
  }

  return true;
}

export async function uninstallSkill(skillId: string): Promise<boolean> {
  const skill = SKILL_REGISTRY.find((s) => s.id === skillId);
  if (!skill) return false;

  // 1. Remove from enabled, add to disabled
  const enabled = (await getEnabledSkills()).filter((id) => id !== skillId);
  const config = await readConfig();
  const disabled = config?.skills?.disabled || [];
  if (!disabled.includes(skillId)) {
    disabled.push(skillId);
  }
  await setEnabledSkills(enabled, disabled);

  // 2. Remove knowledge file if it was created by this skill
  if (skill.knowledgeFile) {
    await deleteDoc(skill.knowledgeFile.path).catch(() => {});
  }

  // 3. Remove directive block if present
  if (skill.directive) {
    try {
      const { readDoc } = await import("./docs");
      const result = await readDoc("directives.md");
      const existing = result?.content || "";
      const marker = `<!-- skill:${skillId} -->`;
      const endMarker = `<!-- /skill:${skillId} -->`;
      if (existing.includes(marker)) {
        const start = existing.indexOf(marker);
        const end = existing.indexOf(endMarker);
        if (start !== -1 && end !== -1) {
          const updated =
            existing.slice(0, start).trimEnd() +
            "\n" +
            existing.slice(end + endMarker.length).trimStart();
          await writeDoc("directives.md", updated.trim() + "\n");
        }
      }
    } catch {
      // Non-critical
    }
  }

  // 4. Remove schedule if it was created by this skill
  if (skill.schedule) {
    const schedules = await readSchedules();
    const existing = schedules.tasks.find((t) => t.name === skill.schedule!.name);
    if (existing) {
      await deleteScheduledTask(existing.id);
    }
  }

  return true;
}
