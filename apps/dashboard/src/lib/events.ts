import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || "/data/activity";
const EVENTS_FILE = path.join(DATA_DIR, "events.ndjson");
const TODAY_FILE = path.join(DATA_DIR, "today.md");

export interface Event {
  ts: string;
  runId: string;
  type: string;
  summary: string;
  details?: Record<string, unknown>;
  risk?: string;
  approvalId?: string;
  requiresApproval?: boolean;
}

export async function readEvents(): Promise<Event[]> {
  try {
    const content = await fs.readFile(EVENTS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line) as Event);
  } catch {
    return [];
  }
}

export async function appendEvent(event: Event): Promise<void> {
  const line = JSON.stringify(event) + "\n";
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await fs.appendFile(EVENTS_FILE, line, "utf-8");
}

export async function readToday(): Promise<string> {
  try {
    return await fs.readFile(TODAY_FILE, "utf-8");
  } catch {
    return "# Today\n\nNo daily summary available yet.";
  }
}

export async function getLatestEvents(limit = 50): Promise<Event[]> {
  const events = await readEvents();
  return events.slice(-limit).reverse();
}

export async function getEventsByRun(): Promise<Map<string, Event[]>> {
  const events = await readEvents();
  const runs = new Map<string, Event[]>();
  for (const event of events) {
    const existing = runs.get(event.runId) || [];
    existing.push(event);
    runs.set(event.runId, existing);
  }
  return runs;
}

export async function getPendingApprovals(): Promise<Event[]> {
  const events = await readEvents();
  const approvals = new Map<string, Event>();

  for (const event of events) {
    if (event.type === "approval.requested" && event.approvalId) {
      approvals.set(event.approvalId, event);
    }
    if (event.type === "approval.resolved" && event.approvalId) {
      approvals.delete(event.approvalId);
    }
  }

  return Array.from(approvals.values());
}

export async function getChatMessages(): Promise<Event[]> {
  const events = await readEvents();
  return events.filter(
    (e) => e.type === "chat.user_message" || e.type === "chat.bot_message",
  );
}

// ─── Dashboard Event Logging ─────────────────────────────────────────────────

/**
 * Log a user action from the dashboard.
 * Uses runId "dashboard" to distinguish from agent events.
 */
export async function logDashboardEvent(
  type: string,
  summary: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await appendEvent({
    ts: new Date().toISOString(),
    runId: "dashboard",
    type,
    summary,
    details: { source: "dashboard", ...details },
  });
}
