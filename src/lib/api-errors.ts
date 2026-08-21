/**
 * api-errors.ts - Standardized API error factory for SentinelRoute.
 *
 * Every API route must use these helpers instead of ad-hoc NextResponse.json
 * error objects. This enforces a consistent error envelope across the platform.
 *
 * Error envelope:
 *   {
 *     error:   string;           // Human-readable message
 *     code?:   string;           // Machine-readable code for client handling
 *     field?:  string;           // Offending field (validation errors only)
 *     traceId?: string;          // Correlation ID for log lookup
 *   }
 *
 * Usage:
 *   return ApiErrors.unauthorized();
 *   return ApiErrors.badRequest("Missing field: origin", "MISSING_FIELD", "origin");
 *   return ApiErrors.internal(err);
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// ─── Envelope type ────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  error:    string;
  code?:    string;
  field?:   string;
  traceId?: string;
}

// ─── Trace ID ─────────────────────────────────────────────────────────────────

function traceId(): string {
  return `tr-${crypto.randomUUID()}`;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export const ApiErrors = {
  /** 400 - Caller provided invalid input. */
  badRequest(
    message = "Bad request",
    code    = "BAD_REQUEST",
    field?: string
  ): NextResponse<ApiErrorBody> {
    const body: ApiErrorBody = { error: message, code };
    if (field) body.field = field;
    return NextResponse.json(body, { status: 400 });
  },

  /** 401 - Missing or invalid authentication. */
  unauthorized(message = "Unauthorized"): NextResponse<ApiErrorBody> {
    return NextResponse.json(
      { error: message, code: "UNAUTHORIZED" },
      { status: 401 }
    );
  },

  /** 403 - Authenticated but not allowed. */
  forbidden(message = "Forbidden"): NextResponse<ApiErrorBody> {
    return NextResponse.json(
      { error: message, code: "FORBIDDEN" },
      { status: 403 }
    );
  },

  /** 404 - Resource does not exist (or is not visible to this caller). */
  notFound(resource = "Resource"): NextResponse<ApiErrorBody> {
    return NextResponse.json(
      { error: `${resource} not found`, code: "NOT_FOUND" },
      { status: 404 }
    );
  },

  /** 409 - State conflict (duplicate, already assigned, etc.). */
  conflict(message: string, code = "CONFLICT"): NextResponse<ApiErrorBody> {
    return NextResponse.json(
      { error: message, code },
      { status: 409 }
    );
  },

  /** 422 - Payload is well-formed but semantically invalid. */
  unprocessable(message: string, field?: string): NextResponse<ApiErrorBody> {
    const body: ApiErrorBody = { error: message, code: "UNPROCESSABLE" };
    if (field) body.field = field;
    return NextResponse.json(body, { status: 422 });
  },

  /** 429 - Rate limit exceeded. */
  rateLimited(retryAfterSec = 60): NextResponse<ApiErrorBody> {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests", code: "RATE_LIMITED" }),
      {
        status:  429,
        headers: {
          "Content-Type":  "application/json",
          "Retry-After":   String(retryAfterSec),
          "X-RateLimit-Limit": "100",
        },
      }
    );
  },

  /**
   * 500 - Unhandled server error.
   * Logs the real error server-side; never exposes internals to the client.
   */
  internal(
    err:     unknown,
    context: string = "api",
    meta:    Record<string, unknown> = {}
  ): NextResponse<ApiErrorBody> {
    const id = traceId();
    logger.error(`${context}.unhandled`, { traceId: id, ...meta }, err);
    return NextResponse.json(
      { error: "An unexpected error occurred", code: "INTERNAL_ERROR", traceId: id },
      { status: 500 }
    );
  },

  /**
   * 503 - Dependency (DB, external API) unavailable.
   * Logs and returns a clean error without internal details.
   */
  serviceUnavailable(
    dependency = "service",
    err?: unknown
  ): NextResponse<ApiErrorBody> {
    const id = traceId();
    if (err) logger.error(`${dependency}.unavailable`, { traceId: id }, err);
    return NextResponse.json(
      { error: `${dependency} is temporarily unavailable`, code: "SERVICE_UNAVAILABLE", traceId: id },
      { status: 503 }
    );
  },
} as const;
