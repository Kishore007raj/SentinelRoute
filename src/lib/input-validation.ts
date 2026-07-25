/**
 * input-validation.ts — Server-side input sanitization helpers.
 *
 * Rules:
 *   - stripHtml()      — removes all HTML tags (XSS prevention)
 *   - sanitizeString() — trims + strips HTML + truncates to max length
 *   - isValidEmail()   — RFC-5321-lite email check
 *   - isValidPhone()   — E.164-compatible check
 *   - isValidDate()    — YYYY-MM-DD ISO date string
 *   - isValidObjectId()— MongoDB-compatible 24-char hex ID
 *   - isPositiveInt()  — number is a finite positive integer
 *   - clampNumber()    — clamps a number to [min, max]
 *
 * Never use client-supplied strings directly in DB queries without first
 * passing them through sanitizeString().
 */

// ─── String sanitization ──────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;
const SCRIPT_RE   = /javascript\s*:/gi;

/**
 * Removes all HTML tags and javascript: protocol from a string.
 * Does NOT HTML-encode — that happens at the rendering layer.
 */
export function stripHtml(value: string): string {
  return value.replace(HTML_TAG_RE, "").replace(SCRIPT_RE, "");
}

/**
 * Full sanitization pipeline for user-supplied string fields.
 * 1. Trim whitespace
 * 2. Strip HTML tags and javascript: URIs
 * 3. Truncate to maxLength (default 2 000 chars)
 *
 * Returns the sanitized string, or "" if the input is falsy.
 */
export function sanitizeString(
  value: unknown,
  maxLength = 2_000
): string {
  if (typeof value !== "string") return "";
  return stripHtml(value.trim()).slice(0, maxLength);
}

/**
 * Sanitizes a short identifier / name (max 255 chars by default).
 * Same as sanitizeString but with a tighter cap.
 */
export function sanitizeName(value: unknown, maxLength = 255): string {
  return sanitizeString(value, maxLength);
}

// ─── Format validators ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;
const DATE_RE  = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HEX24_RE = /^[a-f0-9]{24}$/i;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: unknown): value is string {
  return typeof value === "string" && PHONE_RE.test(value.replace(/[\s\-().]/g, ""));
}

/** Validates YYYY-MM-DD ISO date strings. Does NOT validate calendar correctness. */
export function isValidDate(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value);
}

/** Validates 24-char MongoDB ObjectId hex strings. */
export function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && HEX24_RE.test(value);
}

export function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

// ─── Number helpers ───────────────────────────────────────────────────────────

/** Clamps n to [min, max]. Returns fallback if n is not a finite number. */
export function clampNumber(n: unknown, min: number, max: number, fallback = min): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ─── Pagination helpers ───────────────────────────────────────────────────────

export interface PaginationParams {
  page:  number;
  limit: number;
  skip:  number;
}

/**
 * Extracts and clamps pagination params from a URL search params object.
 * Defaults: page=1, limit=20. Caps: limit<=100.
 */
export function parsePagination(
  searchParams: { get: (key: string) => string | null }
): PaginationParams {
  const rawPage  = parseInt(searchParams.get("page")  ?? "1",  10);
  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);

  const page  = Math.max(1, isNaN(rawPage)  ? 1  : rawPage);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
  const skip  = (page - 1) * limit;

  return { page, limit, skip };
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortDirection = 1 | -1;

/**
 * Parses a sort query param of the form "field:asc" or "field:desc".
 * Only allows fields from the provided allowlist to prevent injection.
 * Returns null if the sort param is absent or invalid.
 */
export function parseSort(
  searchParams: { get: (key: string) => string | null },
  allowedFields: string[]
): Record<string, SortDirection> | null {
  const raw = searchParams.get("sort");
  if (!raw) return null;

  const [field, dir] = raw.split(":");
  if (!field || !allowedFields.includes(field)) return null;

  const direction: SortDirection = dir === "asc" ? 1 : -1;
  return { [field]: direction };
}
