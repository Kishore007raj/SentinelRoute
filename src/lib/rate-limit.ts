/**
 * rate-limit.ts — In-process token-bucket rate limiter for Next.js API routes.
 *
 * Suitable for single-instance deployments (custom server / EC2 / Railway).
 * For multi-instance deployments (Vercel / ECS), swap the store for a Redis
 * backed implementation — the public API is identical.
 *
 * Usage:
 *   const limiter = rateLimit({ windowMs: 60_000, max: 30 });
 *
 *   // Inside a route handler:
 *   const ip = req.headers.get("x-forwarded-for") ?? "unknown";
 *   const { limited, retryAfter } = limiter.check(ip);
 *   if (limited) return ApiErrors.rateLimited(retryAfter);
 *
 * Pre-configured limiters (exported at bottom):
 *   authLimiter      — 10 req / min  (sign-in / sign-up)
 *   apiLimiter       — 120 req / min (general API)
 *   heavyLimiter     — 20 req / min  (AI insight, route analysis)
 *   adminLimiter     — 60 req / min  (admin endpoints)
 */

interface Entry {
  count:   number;
  resetAt: number;
}

interface RateLimitOptions {
  /** Rolling window in milliseconds. Default: 60 000 (1 minute). */
  windowMs: number;
  /** Maximum requests per window per key. */
  max:      number;
}

interface CheckResult {
  limited:    boolean;
  remaining:  number;
  retryAfter: number; // seconds until window resets (0 when not limited)
}

class RateLimiter {
  private readonly store = new Map<string, Entry>();
  private readonly windowMs: number;
  private readonly max:      number;
  private cleanupTimer:       NodeJS.Timeout | null = null;

  constructor({ windowMs, max }: RateLimitOptions) {
    this.windowMs = windowMs;
    this.max      = max;

    // Sweep stale entries every 5 minutes to prevent unbounded memory growth
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60_000);
    // Allow process to exit cleanly even if the timer is still active
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  check(key: string): CheckResult {
    const now     = Date.now();
    let entry     = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + this.windowMs };
      this.store.set(key, entry);
      return { limited: false, remaining: this.max - 1, retryAfter: 0 };
    }

    entry.count += 1;

    if (entry.count > this.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { limited: true, remaining: 0, retryAfter };
    }

    return { limited: false, remaining: this.max - entry.count, retryAfter: 0 };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) this.store.delete(key);
    }
  }
}

// ─── Pre-configured limiters ──────────────────────────────────────────────────

/** 10 req / 60 s — sign-in, sign-up, password reset */
export const authLimiter = new RateLimiter({ windowMs: 60_000, max: 10 });

/** 120 req / 60 s — standard API (shipments, workforce, analytics) */
export const apiLimiter = new RateLimiter({ windowMs: 60_000, max: 120 });

/** 20 req / 60 s — expensive routes (AI insight, route analysis, report generation) */
export const heavyLimiter = new RateLimiter({ windowMs: 60_000, max: 20 });

/** 60 req / 60 s — admin endpoints */
export const adminLimiter = new RateLimiter({ windowMs: 60_000, max: 60 });

// ─── Helper — extract best available client IP ────────────────────────────────

/**
 * Returns the most reliable client IP from a Next.js request.
 * Prefers X-Forwarded-For (set by Vercel / nginx / load balancers).
 * Falls back to the literal string "unknown" — never throws.
 */
export function getClientIp(req: { headers: { get: (key: string) => string | null } }): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // XFF may contain a comma-separated list; first entry is the client
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
