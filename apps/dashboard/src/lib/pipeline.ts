import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { nanoid } from "nanoid";

// ─── Paths ──────────────────────────────────────────────────────────────────

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const WORKSPACE = path.join(OPENCLAW_DIR, "workspace");
const PIPELINE_FILE = path.join(WORKSPACE, "pipeline.json");

// ─── Schemas ────────────────────────────────────────────────────────────────

export const NoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  author: z.string(),
  timestamp: z.string(),
});

export const StageSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const ProjectMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  accent: z.boolean().optional(),
});

export const ProjectFlagSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const ProjectNextStepSchema = z.object({
  text: z.string(),
  done: z.boolean(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.string(),
  category: z.string(),
  location: z.string().optional().default(""),
  details: z.string().optional().default(""),
  metric: z.object({ label: z.string(), value: z.string() }),
  flags: z.array(ProjectFlagSchema).default([]),
  flagStatus: z.enum(["warning", "clean", "info"]).default("clean"),
  flagLabel: z.string().default("Clean"),
  taskCount: z.number().default(0),
  metrics: z.array(ProjectMetricSchema).default([]),
  nextSteps: z.array(ProjectNextStepSchema).default([]),
  notes: z.array(NoteSchema).default([]),
});

export const PipelineFileSchema = z.object({
  stages: z.array(StageSchema),
  projects: z.array(ProjectSchema),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type Note = z.infer<typeof NoteSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type ProjectMetric = z.infer<typeof ProjectMetricSchema>;
export type ProjectFlag = z.infer<typeof ProjectFlagSchema>;
export type ProjectNextStep = z.infer<typeof ProjectNextStepSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type PipelineFile = z.infer<typeof PipelineFileSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  stage: z.string().min(1),
  category: z.string().min(1).max(100),
  location: z.string().max(200).optional(),
  details: z.string().max(500).optional(),
  metric: z.object({ label: z.string(), value: z.string() }).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Atomic write — write to tmp then rename to avoid corruption */
async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmpPath = filePath + ".tmp." + nanoid(6);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tmpPath, data, "utf-8");
  await fs.rename(tmpPath, filePath);
}

/** Generate a slug ID from a label */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

function buildSeedData(): PipelineFile {
  // Lazy import to avoid circular deps — only used on first access
  const {
    STAGES,
    DEMO_PROJECTS,
    DEMO_PROJECT_DETAILS,
  } = require("./demo-data");

  const projects: Project[] = DEMO_PROJECTS.map(
    (p: Record<string, unknown>) => {
      const detail = DEMO_PROJECT_DETAILS[p.id as string] || {};
      const latestNote = detail.latestNote as {
        text?: string;
        author?: string;
        timeAgo?: string;
      } | undefined;

      return {
        id: p.id as string,
        name: p.name as string,
        stage: p.stage as string,
        category: p.category as string,
        location: (detail.location as string) || "",
        details: (detail.details as string) || "",
        metric: p.metric as { label: string; value: string },
        flags: (detail.flags as ProjectFlag[]) || [],
        flagStatus: (p.flagStatus as "warning" | "clean" | "info") || "clean",
        flagLabel: (p.flagLabel as string) || "Clean",
        taskCount: (p.taskCount as number) || 0,
        metrics: (detail.metrics as ProjectMetric[]) || [],
        nextSteps: (detail.nextSteps as ProjectNextStep[]) || [],
        notes: latestNote
          ? [
              {
                id: nanoid(10),
                text: latestNote.text || "",
                author: latestNote.author || "Atlas",
                timestamp: new Date().toISOString(),
              },
            ]
          : [],
      };
    },
  );

  return {
    stages: STAGES.map((s: { id: string; label: string }) => ({
      id: s.id,
      label: s.label,
    })),
    projects,
  };
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export async function readPipeline(): Promise<PipelineFile> {
  try {
    const content = await fs.readFile(PIPELINE_FILE, "utf-8");
    const raw = JSON.parse(content);
    return PipelineFileSchema.parse(raw);
  } catch {
    // File doesn't exist or is invalid — seed from demo data
    const seed = buildSeedData();
    await writePipeline(seed);
    return seed;
  }
}

export async function writePipeline(data: PipelineFile): Promise<void> {
  await atomicWrite(PIPELINE_FILE, JSON.stringify(data, null, 2));
}

// ─── Stages ─────────────────────────────────────────────────────────────────

export async function getStages(): Promise<Stage[]> {
  const data = await readPipeline();
  return data.stages;
}

export async function updateStages(stages: Stage[]): Promise<Stage[]> {
  const data = await readPipeline();
  const oldStageIds = new Set(data.stages.map((s) => s.id));
  const newStageIds = new Set(stages.map((s) => s.id));

  // If a stage was removed, move its projects to the first remaining stage
  const firstStageId = stages[0]?.id;
  if (firstStageId) {
    for (const project of data.projects) {
      if (!newStageIds.has(project.stage)) {
        project.stage = firstStageId;
      }
    }
  }

  data.stages = stages;
  await writePipeline(data);
  return stages;
}

// ─── Projects ───────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const data = await readPipeline();
  return data.projects;
}

export async function getProjectById(
  id: string,
): Promise<Project | null> {
  const data = await readPipeline();
  return data.projects.find((p) => p.id === id) || null;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const data = await readPipeline();

  const project: Project = {
    id: nanoid(10),
    name: input.name,
    stage: input.stage,
    category: input.category,
    location: input.location || "",
    details: input.details || "",
    metric: input.metric || { label: "NOI", value: "TBD" },
    flags: [],
    flagStatus: "clean",
    flagLabel: "Clean",
    taskCount: 0,
    metrics: [],
    nextSteps: [],
    notes: [],
  };

  data.projects.push(project);
  await writePipeline(data);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Project>,
): Promise<Project | null> {
  const data = await readPipeline();
  const index = data.projects.findIndex((p) => p.id === id);
  if (index === -1) return null;

  // Apply patch (only known fields)
  const project = data.projects[index]!;
  if (patch.name !== undefined) project.name = patch.name;
  if (patch.stage !== undefined) project.stage = patch.stage;
  if (patch.category !== undefined) project.category = patch.category;
  if (patch.location !== undefined) project.location = patch.location;
  if (patch.details !== undefined) project.details = patch.details;
  if (patch.metric !== undefined) project.metric = patch.metric;
  if (patch.flags !== undefined) project.flags = patch.flags;
  if (patch.flagStatus !== undefined) project.flagStatus = patch.flagStatus;
  if (patch.flagLabel !== undefined) project.flagLabel = patch.flagLabel;
  if (patch.taskCount !== undefined) project.taskCount = patch.taskCount;
  if (patch.metrics !== undefined) project.metrics = patch.metrics;
  if (patch.nextSteps !== undefined) project.nextSteps = patch.nextSteps;
  if (patch.notes !== undefined) project.notes = patch.notes;

  data.projects[index] = project;
  await writePipeline(data);
  return project;
}

export async function deleteProject(id: string): Promise<boolean> {
  const data = await readPipeline();
  const prevLen = data.projects.length;
  data.projects = data.projects.filter((p) => p.id !== id);
  if (data.projects.length < prevLen) {
    await writePipeline(data);
    return true;
  }
  return false;
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export async function getProjectNotes(
  projectId: string,
): Promise<Note[]> {
  const project = await getProjectById(projectId);
  return project?.notes || [];
}

export async function addNote(
  projectId: string,
  input: { text: string; author: string },
): Promise<Note | null> {
  const data = await readPipeline();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return null;

  const note: Note = {
    id: nanoid(10),
    text: input.text,
    author: input.author,
    timestamp: new Date().toISOString(),
  };

  project.notes.push(note);
  await writePipeline(data);
  return note;
}

// ─── Utility ────────────────────────────────────────────────────────────────

export { slugify };
