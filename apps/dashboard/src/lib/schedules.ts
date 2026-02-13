import { promises as fs } from "fs";
import path from "path";

const WORKSPACE_DIR =
  process.env.OPENCLAW_WORKSPACE || "/root/.openclaw/workspace";
const SCHEDULES_FILE = path.join(WORKSPACE_DIR, "schedules.json");

export interface ScheduledTask {
  id: string;
  name: string;
  color: "blue" | "green" | "orange" | "red" | "purple" | "yellow";
  type: "recurring" | "always-running";
  schedule: {
    frequency: "daily" | "weekly" | "interval";
    time?: string; // "05:00" for daily/weekly
    days?: number[]; // [0,1,2,3,4,5,6] for weekly (0=Sun)
    intervalMinutes?: number; // for always-running type
  };
  enabled: boolean;
  lastRun?: string;
  createdAt: string;
}

export interface SchedulesFile {
  tasks: ScheduledTask[];
}

export async function readSchedules(): Promise<SchedulesFile> {
  try {
    const raw = await fs.readFile(SCHEDULES_FILE, "utf-8");
    return JSON.parse(raw) as SchedulesFile;
  } catch {
    return { tasks: [] };
  }
}

export async function writeSchedules(data: SchedulesFile): Promise<void> {
  const dir = path.dirname(SCHEDULES_FILE);
  await fs.mkdir(dir, { recursive: true });
  const tmp = SCHEDULES_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, SCHEDULES_FILE);
}

export async function createScheduledTask(
  task: Omit<ScheduledTask, "id" | "createdAt">,
): Promise<ScheduledTask> {
  const data = await readSchedules();
  const newTask: ScheduledTask = {
    ...task,
    id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  data.tasks.push(newTask);
  await writeSchedules(data);
  return newTask;
}

export async function updateScheduledTask(
  id: string,
  updates: Partial<ScheduledTask>,
): Promise<ScheduledTask | null> {
  const data = await readSchedules();
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  data.tasks[idx] = { ...data.tasks[idx]!, ...updates };
  await writeSchedules(data);
  return data.tasks[idx]!;
}

export async function deleteScheduledTask(id: string): Promise<boolean> {
  const data = await readSchedules();
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  data.tasks.splice(idx, 1);
  await writeSchedules(data);
  return true;
}

/** Compute the next run time for a scheduled task */
export function getNextRun(task: ScheduledTask): Date | null {
  if (!task.enabled) return null;
  const now = new Date();

  if (task.type === "always-running" && task.schedule.intervalMinutes) {
    if (task.lastRun) {
      const last = new Date(task.lastRun);
      return new Date(last.getTime() + task.schedule.intervalMinutes * 60000);
    }
    // If never run, next run is now
    return now;
  }

  if (task.schedule.frequency === "daily" && task.schedule.time) {
    const [h, m] = task.schedule.time.split(":").map(Number);
    const next = new Date(now);
    next.setHours(h!, m!, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  if (
    task.schedule.frequency === "weekly" &&
    task.schedule.time &&
    task.schedule.days?.length
  ) {
    const [h, m] = task.schedule.time.split(":").map(Number);
    // Find next matching day
    for (let offset = 0; offset < 8; offset++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(h!, m!, 0, 0);
      if (
        task.schedule.days.includes(candidate.getDay()) &&
        candidate > now
      ) {
        return candidate;
      }
    }
  }

  return null;
}

/** Get all next runs sorted by time */
export function getUpcomingRuns(
  tasks: ScheduledTask[],
): { task: ScheduledTask; nextRun: Date }[] {
  const runs: { task: ScheduledTask; nextRun: Date }[] = [];
  for (const task of tasks) {
    const nextRun = getNextRun(task);
    if (nextRun) {
      runs.push({ task, nextRun });
    }
  }
  return runs.sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
}
