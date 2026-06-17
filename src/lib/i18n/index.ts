/**
 * i18n/index.ts — Public barrel export for the i18n module.
 *
 * All consumers import from "@/lib/i18n":
 *
 *   import { useI18n, I18nProvider, LOCALE_INFO, SUPPORTED_LOCALES } from "@/lib/i18n";
 */

export { useI18n, I18nProvider } from "./context";
export { getTranslations, resolveLocale, getKey } from "./loader";
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
