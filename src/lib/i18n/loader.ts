/**
 * i18n/loader.ts — Static locale loader with in-memory cache.
 *
 * All locale files are bundled at build time (imported statically).
 * No network requests. No runtime file reads. No AI translation.
 * Translations are deterministic and identical every time.
 *
 * The cache is a simple Map — locale data is loaded once per locale
 * per process and never re-fetched.
 *
 * LibreTranslate (self-hosted only) hook is defined here for future
 * dynamic translation — it is NOT connected or called anywhere yet.
 */

import type { Translation, SupportedLocale } from "./types";
import { FALLBACK_LOCALE } from "./types";

// ─── Static imports — all bundled at build time ───────────────────────────────
// Each import is a static JSON file. Bundler inlines them at compile time.

import en from "@/locales/en/common.json";
import hi from "@/locales/hi/common.json";
import ta from "@/locales/ta/common.json";
import te from "@/locales/te/common.json";
import kn from "@/locales/kn/common.json";
import ml from "@/locales/ml/common.json";
import mr from "@/locales/mr/common.json";
import bn from "@/locales/bn/common.json";
import gu from "@/locales/gu/common.json";
import pa from "@/locales/pa/common.json";
import or_ from "@/locales/or/common.json";  // "or" is a reserved word in JS

// ─── Static locale map ────────────────────────────────────────────────────────

const LOCALE_MAP: Record<SupportedLocale, Translation> = {
  en: en as Translation,
  hi: hi as Translation,
  ta: ta as Translation,
  te: te as Translation,
  kn: kn as Translation,
  ml: ml as Translation,
  mr: mr as Translation,
  bn: bn as Translation,
  gu: gu as Translation,
  pa: pa as Translation,
  or: or_ as Translation,
};

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Redundant given static imports, but provides a consistent API for future
// dynamic locale loading (e.g. server-fetched translations from a CMS).

const cache = new Map<SupportedLocale, Translation>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the Translation object for the given locale.
 * Falls back to English if the locale is not found.
 * Never throws.
 */
export function getTranslations(locale: SupportedLocale): Translation {
  const cached = cache.get(locale);
  if (cached) return cached;

  const translations = LOCALE_MAP[locale] ?? LOCALE_MAP[FALLBACK_LOCALE];
  cache.set(locale, translations);
  return translations;
}

/**
 * Resolves a locale string to a supported SupportedLocale.
 * Accepts full BCP-47 tags ("en-US" → "en", "hi-IN" → "hi").
 * Falls back to FALLBACK_LOCALE if unrecognised.
 */
export function resolveLocale(raw: string | null | undefined): SupportedLocale {
  if (!raw) return FALLBACK_LOCALE;
  const base = raw.split("-")[0].toLowerCase() as SupportedLocale;
  return base in LOCALE_MAP ? base : FALLBACK_LOCALE;
}

/**
 * Retrieves a nested translation key using dot notation.
 * Example: getKey(t, "logistics.riskScore") → "Risk Score"
 * Falls back to the key string if not found.
 */
export function getKey(t: Translation, key: string): string {
  const parts = key.split(".");
  let current: unknown = t;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}

// ─── LibreTranslate hook (future — self-hosted only) ─────────────────────────
// When dynamic translation of user-generated content is needed, implement
// this with a self-hosted LibreTranslate instance. All results must be cached.
// DO NOT use public endpoints, unofficial APIs, or AI-based translation.
//
// interface LibreTranslateResult {
//   translatedText: string;
//   cached: boolean;
// }
//
// export async function translateDynamic(
//   text: string,
//   targetLocale: SupportedLocale,
//   sourceLocale: SupportedLocale = "en"
// ): Promise<LibreTranslateResult> {
//   // 1. Check translation cache (MongoDB collection: translation_cache)
//   // 2. If cached, return immediately
//   // 3. POST to self-hosted LibreTranslate endpoint
//   // 4. Store result in cache
//   // 5. Return result
//   throw new Error("LibreTranslate not yet configured. Host internally first.");
// }
