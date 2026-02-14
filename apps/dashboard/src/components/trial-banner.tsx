import { getSubscriptionStatus } from "@/lib/subscription-status";
import { AlertTriangle, Clock, ExternalLink } from "lucide-react";

/**
 * Server component that shows a banner for trial and expired-trial users.
 * Reads subscription status from the file written by the heartbeat cron.
 */
export function TrialBanner() {
  const sub = getSubscriptionStatus();

  // No banner if no subscription data, or if subscription is active/paid
  if (!sub) return null;
  if (sub.status === "ACTIVE") return null;
  if (sub.status === "PAST_DUE") return null;

  const subscribeUrl = "https://capable.ai/settings";

  if (sub.status === "TRIALING") {
    const daysLeft = sub.daysLeft ?? 0;
    const daysText = daysLeft === 1 ? "1 day" : `${daysLeft} days`;

    return (
      <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            <strong>Free trial:</strong> {daysText} remaining.
            Subscribe to keep your agent running after the trial.
          </span>
        </div>
        <a
          href={subscribeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
        >
          Subscribe now
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  if (sub.status === "CANCELED") {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-red-500/30 bg-red-50 px-4 py-2.5 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Trial expired.</strong> Subscribe to continue using your agent.
          </span>
        </div>
        <a
          href={subscribeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
        >
          Subscribe now
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return null;
}
