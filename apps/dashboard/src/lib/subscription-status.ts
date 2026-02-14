import { readFileSync } from "fs";

export interface SubscriptionStatus {
  status: string; // "ACTIVE" | "TRIALING" | "CANCELED" | "PAST_DUE" | "UNPAID"
  trialEnd: string | null;
  periodEnd: string;
  daysLeft: number | null;
}

/**
 * Reads subscription status from the JSON file written by the heartbeat cron.
 * Returns null if the file doesn't exist or is empty/invalid.
 */
export function getSubscriptionStatus(): SubscriptionStatus | null {
  try {
    const raw = readFileSync("/app/.subscription-status.json", "utf-8").trim();
    if (!raw) return null;
    return JSON.parse(raw) as SubscriptionStatus;
  } catch {
    return null; // File doesn't exist yet, is empty, or has invalid JSON
  }
}
