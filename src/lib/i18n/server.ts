/**
 * i18n/server.ts — Server-side translation utilities.
 *
 * Used in API routes, Server Components, and background jobs to produce
 * localised text for notifications, error messages, and audit descriptions.
 *
 * No React. No client state. Pure functions only.
 *
 * Usage in API routes:
 *   const t = serverT(userLocale);
 *   return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
 *
 * Usage for notification content:
 *   const t = serverT(driver.preferredLanguage);
 *   const message = t("notifications.riskAlert");
 */

import { getTranslations, resolveLocale, getKey } from "./loader";
import type { SupportedLocale, Translation } from "./types";
import { FALLBACK_LOCALE } from "./types";

// ─── Primary API ──────────────────────────────────────────────────────────────

/**
 * Returns a bound translation function for the given locale string.
 * Accepts any string (BCP-47, short code, null) — resolves safely.
 *
 * @param locale  raw locale string, e.g. "hi", "en-IN", null
 * @returns       (key: string) => string
 */
export function serverT(locale: string | null | undefined): (key: string) => string {
  const resolved: SupportedLocale = resolveLocale(locale);
  const t = getTranslations(resolved);
  return (key: string) => getKey(t, key);
}

/**
 * Returns the full Translation object for the given locale.
 * Useful when many keys are needed at once (avoids multiple function calls).
 */
export function serverTranslations(locale: string | null | undefined): Translation {
  return getTranslations(resolveLocale(locale));
}

/**
 * Returns a translation function that tries the preferred locale first,
 * falls back to the company fallback language, then to English.
 *
 * Used when serving multilingual notifications where the driver's language
 * may differ from the company's configured fallback.
 */
export function serverTWithFallback(
  preferredLocale: string | null | undefined,
  fallbackLocale:  string | null | undefined
): (key: string) => string {
  const preferred = resolveLocale(preferredLocale);
  const fallback  = resolveLocale(fallbackLocale) ?? FALLBACK_LOCALE;

  const preferredT  = getTranslations(preferred);
  const fallbackT   = getTranslations(fallback);
  const defaultT    = getTranslations(FALLBACK_LOCALE);

  return (key: string) => {
    const val = getKey(preferredT, key);
    // If preferred translation equals the key itself, the key wasn't found — try fallback
    if (val === key) {
      const fb = getKey(fallbackT, key);
      if (fb === key) return getKey(defaultT, key);
      return fb;
    }
    return val;
  };
}

/**
 * Resolves the best locale for a notification recipient.
 *
 * Priority order (highest to lowest):
 *   1. User's personal preferredLanguage
 *   2. Company's preferredLanguage
 *   3. Company's fallbackLanguage
 *   4. "en"
 */
export function resolveNotificationLocale(opts: {
  userLanguage?:    string | null;
  companyLanguage?: string | null;
  companyFallback?: string | null;
}): SupportedLocale {
  return (
    resolveLocale(opts.userLanguage) ??
    resolveLocale(opts.companyLanguage) ??
    resolveLocale(opts.companyFallback) ??
    FALLBACK_LOCALE
  );
}
