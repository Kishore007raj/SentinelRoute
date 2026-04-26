/**
 * time.ts — Timezone-aware time utilities for SentinelRoute.
 *
 * RULE: All timestamps are stored and transmitted as UTC ISO 8601 strings.
 *       Display formatting always uses the viewer's local timezone via
 *       Intl.DateTimeFormat — so a user in India sees IST, a user in
 *       New York sees EST, etc. No hardcoded timezone offsets anywhere.
 *
 * Server-side: use `utcNow()` to generate timestamps.
 * Client-side: use `formatLocalTime()` / `formatRelativeTime()` to display.
 */

// ─── Server helpers ───────────────────────────────────────────────────────────

/** Returns the current UTC time as an ISO 8601 string. Always use this for storage. */
export function utcNow(): string {
  return new Date().toISOString();
}

// ─── Client display helpers ───────────────────────────────────────────────────

/**
 * Formats a UTC ISO string into the user's local time.
 * e.g. "2:34 PM" in India, "9:04 AM" in New York — automatically correct.
 */
export function formatLocalTime(utcIso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour:   "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(utcIso));
  } catch {
    return utcIso;
  }
}

/**
 * Formats a UTC ISO string into a full local date + time string.
 * e.g. "26 Apr 2026, 2:34 PM"
 */
export function formatLocalDateTime(utcIso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day:    "numeric",
      month:  "short",
      year:   "numeric",
      hour:   "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(utcIso));
  } catch {
    return utcIso;
  }
}

/**
 * Returns a human-readable relative time string.
 * e.g. "just now", "2 min ago", "3 hours ago", "yesterday"
 * Works for any user's timezone — the relative gap is timezone-independent.
 */
export function formatRelativeTime(utcIso: string): string {
  try {
    const diffMs  = Date.now() - new Date(utcIso).getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 10)   return "just now";
    if (diffSec < 60)   return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)   return `${diffMin} min ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)    return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1)  return "yesterday";
    if (diffDay < 7)    return `${diffDay} days ago`;

    // Older than a week — show local date
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(utcIso));
  } catch {
    return utcIso;
  }
}

/**
 * Returns the user's IANA timezone name.
 * e.g. "Asia/Kolkata", "America/New_York", "Europe/London"
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
