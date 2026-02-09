/**
 * Simple in-memory rate limiter for the dashboard.
 *
 * The dashboard runs as a standalone Next.js app with no database,
 * so we use a Map-based sliding window counter. Entries auto-expire
 * to prevent unbounded memory growth.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
 *   // In your route handler:
 *   const ip = req.headers.get("x-forwarded-for") ?? "unknown";
 *   if (!limiter.check(ip)) {
 *     return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests per window */
  max: number;
}

interface RateLimiter {
  /** Returns true if the request is allowed, false if rate-limited */
  check(key: string): boolean;
  /** Returns remaining requests for the key (for headers) */
  remaining(key: string): number;
}

/**
 * Creates a rate limiter with a fixed window.
 * Old entries are lazily cleaned up to prevent memory leaks.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = options;
  const entries = new Map<string, RateLimitEntry>();

  // Clean up expired entries every 5 minutes
  const CLEANUP_INTERVAL = 5 * 60 * 1000;
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [key, entry] of entries) {
      if (now >= entry.resetAt) {
        entries.delete(key);
      }
    }
  }

  function getEntry(key: string): RateLimitEntry {
    const now = Date.now();
    const existing = entries.get(key);
    if (existing && now < existing.resetAt) {
      return existing;
    }
    // Create new window
    const entry: RateLimitEntry = { count: 0, resetAt: now + windowMs };
    entries.set(key, entry);
    return entry;
  }

  return {
    check(key: string): boolean {
      cleanup();
      const entry = getEntry(key);
      entry.count++;
      return entry.count <= max;
    },
    remaining(key: string): number {
      const entry = entries.get(key);
      if (!entry || Date.now() >= entry.resetAt) return max;
      return Math.max(0, max - entry.count);
    },
  };
}

// Pre-configured limiters for dashboard endpoints
/** Login attempts: 5 per minute per IP */
export const authLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/** Admin API calls: 30 per minute per IP */
export const adminLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
