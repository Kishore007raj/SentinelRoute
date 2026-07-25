/**
 * logger.ts — Structured server-side logger for SentinelRoute.
 *
 * Outputs JSON in production (for log aggregators like Datadog, CloudWatch,
 * GCP Logging) and human-readable coloured output in development.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *
 *   logger.info("shipment.created", { shipmentId, companyId });
 *   logger.warn("auth.tokenExpired", { userId });
 *   logger.error("db.queryFailed", { collection: "shipments" }, err);
 *   logger.audit("shipment.statusChange", { companyId, userId, shipmentId, from, to });
 *
 * Fields always included:
 *   ts        — UTC ISO timestamp
 *   level     — info | warn | error | audit
 *   event     — dot-namespaced event identifier
 *   env       — NODE_ENV
 *   ...meta   — caller-supplied key/value metadata
 *
 * Rules:
 *   - Never log secret values (tokens, keys, passwords).
 *   - Never log PII (aadhaar, full addresses) in production.
 *   - audit() writes are immutable records — never suppressed.
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "audit";

interface LogEntry {
  ts:     string;
  level:  LogLevel;
  event:  string;
  env:    string;
  [key: string]: unknown;
}

const isProd = process.env.NODE_ENV === "production";

// ─── Colour codes for dev output ─────────────────────────────────────────────

const COLOURS: Record<LogLevel, string> = {
  debug: "\x1b[90m",   // grey
  info:  "\x1b[36m",   // cyan
  warn:  "\x1b[33m",   // yellow
  error: "\x1b[31m",   // red
  audit: "\x1b[35m",   // magenta
};
const RESET = "\x1b[0m";

// ─── Core write ───────────────────────────────────────────────────────────────

function write(
  level: LogLevel,
  event: string,
  meta: Record<string, unknown> = {},
  err?: unknown
): void {
  const entry: LogEntry = {
    ts:    new Date().toISOString(),
    level,
    event,
    env:   process.env.NODE_ENV ?? "unknown",
    ...meta,
  };

  if (err !== undefined) {
    if (err instanceof Error) {
      entry.errorMessage = err.message;
      entry.errorStack   = isProd ? undefined : err.stack;
      entry.errorName    = err.name;
    } else {
      entry.error = String(err);
    }
  }

  if (isProd) {
    // Compact JSON — one line per entry for log aggregators
    const line = JSON.stringify(entry);
    if (level === "error" || level === "audit") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  } else {
    // Human-readable coloured output for development
    const colour = COLOURS[level];
    const prefix = `${colour}[${level.toUpperCase().padEnd(5)}]${RESET}`;
    const metaStr = Object.keys(meta).length
      ? " " + Object.entries(meta).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ")
      : "";
    const errStr = err instanceof Error ? ` | ${err.message}` : "";
    console.log(`${prefix} ${entry.ts} ${event}${metaStr}${errStr}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  /** Low-level debug information — suppressed in production. */
  debug(event: string, meta?: Record<string, unknown>): void {
    if (isProd) return;
    write("debug", event, meta);
  },

  /** Normal operational events. */
  info(event: string, meta?: Record<string, unknown>): void {
    write("info", event, meta);
  },

  /** Recoverable issues that should be investigated. */
  warn(event: string, meta?: Record<string, unknown>, err?: unknown): void {
    write("warn", event, meta, err);
  },

  /** Errors that caused a request to fail or a system to degrade. */
  error(event: string, meta?: Record<string, unknown>, err?: unknown): void {
    write("error", event, meta, err);
  },

  /**
   * Immutable audit trail — security, compliance, and data-change events.
   * Always written, even in test environments.
   * Include: companyId, userId, action, affected resource IDs.
   * Never include: token values, raw passwords, PII.
   */
  audit(event: string, meta: Record<string, unknown>): void {
    write("audit", event, meta);
  },
} as const;

export type Logger = typeof logger;
