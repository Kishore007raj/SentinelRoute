/**
 * i18n/index.ts — Public barrel export for the i18n module.
 *
 * Client-side (React):
 *   import { useI18n, I18nProvider } from "@/lib/i18n";
 *
 * Server-side (API routes, Server Components):
 *   import { serverT, serverTranslations, serverTWithFallback } from "@/lib/i18n/server";
 *   — OR —
 *   import { serverT } from "@/lib/i18n";
 */

export { useI18n, I18nProvider } from "./context";
export { getTranslations, resolveLocale, getKey } from "./loader";
export { serverT, serverTranslations, serverTWithFallback, resolveNotificationLocale } from "./server";
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_INFO,
} from "./types";
export type {
  SupportedLocale,
  LocaleInfo,
  Translation,
} from "./types";
