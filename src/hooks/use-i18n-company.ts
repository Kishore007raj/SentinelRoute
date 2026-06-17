"use client";
/**
 * use-i18n-company.ts — Syncs the active UI locale from company settings.
 *
 * After the company context loads, reads:
 *   1. User's personal preferredLanguage (UserRecord)
 *   2. Company's preferredLanguage (Company)
 *   3. Falls back to "en"
 *
 * Calls setLocale() from the I18nProvider to update the active translation.
 *
 * Usage: mount once inside the (app) layout after CompanyProvider is ready.
 *
 *   useI18nCompany();  // no args, no return — side-effect only
 */

import { useEffect } from "react";
import { useCompany } from "@/lib/company-context";
import { useI18n } from "@/lib/i18n";
import { resolveLocale } from "@/lib/i18n";

export function useI18nCompany(): void {
  const { company, userRecord } = useCompany();
  const { setLocale, locale } = useI18n();

  useEffect(() => {
    // Priority: user personal preference > company preference > "en"
    const preferred =
      userRecord?.preferredLanguage ??
      company?.preferredLanguage ??
      "en";

    const resolved = resolveLocale(preferred);

    // Only call setLocale if it actually changes — avoids unnecessary re-renders
    if (resolved !== locale) {
      setLocale(resolved);
    }
  }, [
    userRecord?.preferredLanguage,
    company?.preferredLanguage,
    locale,
    setLocale,
  ]);
}
