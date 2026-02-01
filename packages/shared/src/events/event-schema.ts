import { z } from "zod";
import { EVENT_TYPE_VALUES } from "./event-types";

export const RiskLevel = z.enum(["none", "low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const EventSchema = z.object({
  ts: z.string(),
  runId: z.string(),
  type: z.enum(EVENT_TYPE_VALUES as [string, ...string[]]),
  summary: z.string(),
  details: z.record(z.unknown()).optional(),
  risk: RiskLevel.optional(),
  approvalId: z.string().optional(),
  requiresApproval: z.boolean().optional(),
});

export type Event = z.infer<typeof EventSchema>;

export function createEvent(
  partial: Omit<Event, "ts"> & { ts?: string },
): Event {
  return {
    ts: new Date().toISOString(),
    ...partial,
  };
}

export function parseEventLine(line: string): Event | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return EventSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function serializeEvent(event: Event): string {
  return JSON.stringify(event);
}
