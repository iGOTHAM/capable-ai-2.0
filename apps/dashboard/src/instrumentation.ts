/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * Used to initialize:
 * - ChannelManager (Telegram long-polling, etc.)
 * - Future: Scheduler (cron tasks)
 */

export async function register() {
  // Only run on the server (not during build or client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { channelManager } = await import("@/lib/channels");
    await channelManager.init();
    console.log("[Instrumentation] Server started, channels initialized");
  }
}
