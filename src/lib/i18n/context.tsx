"use client";
/**
 * i18n/context.tsx — React i18n context for SentinelRoute.
 *
 * Provides:
 *   - useI18n()  → { t, locale, setLocale, localeInfo, supportedLocales }
 *   - I18nProvider → wraps the app, reads locale preference from:
 *       1. User's stored preference (via CompanySettings or UserSettings)
 *       2. Browser navigator.language
 *       3. Default: "en"
 *
 * The `t` function is a typed accessor:
 *   t("logistics.riskScore")   → "Risk Score" (en)
 *   t("logistics.riskScore")   → "रिस्क स्कोर" (hi)
 *
 * No runtime API calls. All translations are statically bundled.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupportedLocale, LocaleInfo } from "./types";
import { SUPPORTED_LOCALES, LOCALE_INFO, DEFAULT_LOCALE } from "./types";
import { getTranslations, resolveLocale, getKey } from "./loader";
import type { Translation } from "./types";

// ─── Storage key ──────────────────────────────────────────────────────────────

const LOCALE_STORAGE_KEY = "sr_locale";

// ─── Context shape ────────────────────────────────────────────────────────────

interface I18nContextValue {
  /** Current active locale code */
  locale:           SupportedLocale;
  /** Translated string accessor — pass dot-notation key */
  t:                (key: string) => string;
  /** Full translation object for direct property access */
  translations:     Translation;
  /** Change the active locale */
  setLocale:        (locale: SupportedLocale) => void;
  /** Metadata for the current locale */
  localeInfo:       LocaleInfo;
  /** All supported locales with metadata */
  supportedLocales: LocaleInfo[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface I18nProviderProps {
  children:      React.ReactNode;
  /** Override locale (e.g. from CompanySettings.language) */
  initialLocale?: string;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    // Priority: prop > localStorage > browser language > default
    if (initialLocale) return resolveLocale(initialLocale);

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored) return resolveLocale(stored);
      return resolveLocale(navigator.language);
    }

    return DEFAULT_LOCALE;
  });

  // Sync to localStorage whenever locale changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  // Update locale when initialLocale prop changes (e.g. after company settings load)
  useEffect(() => {
    if (initialLocale) {
      const resolved = resolveLocale(initialLocale);
      setLocaleState(resolved);
    }
  }, [initialLocale]);

  const translations = useMemo(() => getTranslations(locale), [locale]);

  const t = useCallback(
    (key: string) => getKey(translations, key),
    [translations]
  );

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
  }, []);

  const value = useMemo(
    (): I18nContextValue => ({
      locale,
      t,
      translations,
      setLocale,
      localeInfo:       LOCALE_INFO[locale],
      supportedLocales: SUPPORTED_LOCALES.map((c) => LOCALE_INFO[c]),
    }),
    [locale, t, translations, setLocale]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Primary hook for accessing translations.
 *
 * Usage:
 *   const { t } = useI18n();
 *   <span>{t("logistics.riskScore")}</span>
 *
 * With full translation object:
 *   const { translations: tr } = useI18n();
 *   <span>{tr.logistics.riskScore}</span>
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
