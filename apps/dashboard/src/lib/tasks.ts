import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { nanoid } from "nanoid";

// ─── Paths ──────────────────────────────────────────────────────────────────

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const WORKSPACE = path.join(OPENCLAW_DIR, "workspace");
const TASKS_FILE = path.join(WORKSPACE, "tasks.json");

// ─── Schema ─────────────────────────────────────────────────────────────────

/** Matches pack-generator format + dashboard extensions */
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  status: z.enum(["pending", "in-progress", "done", "archived"]),
  priority: z.enum(["high", "medium", "low"]),
  notes: z.string().optional(),
  context: z.string().optional(), // backwards compat with pack format
  created: z.string(),
  updated: z.string().optional(),
  createdBy: z.enum(["user", "agent"]).optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const TasksFileSchema = z.object({
  tasks: z.array(TaskSchema),
  completed: z.array(TaskSchema),
});

export type TasksFile = z.infer<typeof TasksFileSchema>;

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  status: z.enum(["pending", "in-progress", "done"]).default("pending"),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["pending", "in-progress", "done", "archived"]).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalize a task from pack format: merge context → notes */
function normalizeTask(raw: Record<string, unknown>): Task {
  const task = { ...raw } as Task;
  // If task has context but no notes, use context as notes
  if (task.context && !task.notes) {
    task.notes = task.context;
  }
  // Ensure required fields have defaults
  if (!task.status) task.status = "pending";
  if (!task.priority) task.priority = "medium";
  if (!task.created) task.created = new Date().toISOString();
  return task;
}

/** Atomic write — write to tmp then rename to avoid corruption */
async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmpPath = filePath + ".tmp." + nanoid(6);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tmpPath, data, "utf-8");
  await fs.rename(tmpPath, filePath);
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

export async function readTasks(): Promise<TasksFile> {
  try {
    const content = await fs.readFile(TASKS_FILE, "utf-8");
    const raw = JSON.parse(content);
    // Normalize tasks for backwards compat
    const tasks = (raw.tasks || []).map((t: Record<string, unknown>) =>
      normalizeTask(t),
    );
    const completed = (raw.completed || []).map(
      (t: Record<string, unknown>) => normalizeTask(t),
    );
    return { tasks, completed };
  } catch {
    return { tasks: [], completed: [] };
  }
}

export async function writeTasks(data: TasksFile): Promise<void> {
  // Write both notes AND context for backwards compat with agent
  const serialize = (tasks: Task[]) =>
    tasks.map((t) => ({
      ...t,
      context: t.notes || t.context || "", // agent reads context
    }));

  const output = {
    tasks: serialize(data.tasks),
    completed: serialize(data.completed),
  };
  await atomicWrite(TASKS_FILE, JSON.stringify(output, null, 2));
}

export async function addTask(
  input: z.infer<typeof CreateTaskSchema>,
): Promise<Task> {
  const data = await readTasks();
  const task: Task = {
    id: nanoid(10),
    title: input.title,
    status: input.status || "pending",
    priority: input.priority || "medium",
    notes: input.notes,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    createdBy: "user",
  };
  data.tasks.push(task);
  await writeTasks(data);
  return task;
}

export async function updateTask(
  id: string,
  patch: z.infer<typeof UpdateTaskSchema>,
): Promise<Task | null> {
  const data = await readTasks();

  // Search in both tasks and completed arrays
  let task = data.tasks.find((t) => t.id === id);
  let inCompleted = false;
  if (!task) {
    task = data.completed.find((t) => t.id === id);
    inCompleted = true;
  }
  if (!task) return null;

  // Apply patch
  if (patch.title !== undefined) task.title = patch.title;
  if (patch.notes !== undefined) task.notes = patch.notes;
  if (patch.priority !== undefined) task.priority = patch.priority;
  task.updated = new Date().toISOString();

  // Handle status changes — move between arrays if needed
  if (patch.status !== undefined && patch.status !== task.status) {
    const oldStatus = task.status;
    task.status = patch.status;

    if (patch.status === "archived") {
      // Move to completed array
      if (!inCompleted) {
        data.tasks = data.tasks.filter((t) => t.id !== id);
        data.completed.push(task);
      }
    } else if (oldStatus === "archived" || inCompleted) {
      // Move back to tasks array
      data.completed = data.completed.filter((t) => t.id !== id);
      data.tasks.push(task);
    }
  }

  await writeTasks(data);
  return task;
}

export async function archiveTask(id: string): Promise<boolean> {
  const result = await updateTask(id, { status: "archived" });
  return result !== null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const data = await readTasks();
  const prevLen = data.tasks.length + data.completed.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  data.completed = data.completed.filter((t) => t.id !== id);
  const newLen = data.tasks.length + data.completed.length;
  if (newLen < prevLen) {
    await writeTasks(data);
    return true;
  }
  return false;
}

// ─── Stats (for dashboard home) ─────────────────────────────────────────────

export interface TaskStats {
  pending: number;
  inProgress: number;
  done: number;
  archived: number;
}

export async function getTaskStats(): Promise<TaskStats> {
  const data = await readTasks();
  const allTasks = [...data.tasks, ...data.completed];
  return {
    pending: allTasks.filter((t) => t.status === "pending").length,
    inProgress: allTasks.filter((t) => t.status === "in-progress").length,
    done: allTasks.filter((t) => t.status === "done").length,
    archived: allTasks.filter((t) => t.status === "archived").length,
  };
}
