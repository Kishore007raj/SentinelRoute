/**
 * company-settings.ts — Helpers for the company_settings collection.
 *
 * company_settings stores per-company configuration: language, timezone,
 * riskThreshold, autoApprovalEnabled.
 *
 * A settings document is created automatically when a company is registered.
 * All reads use getOrCreateCompanySettings() so the document always exists.
 */

import type { Db } from "mongodb";
import type { CompanySettings } from "@/lib/types";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/types";

// ─── Get or create ────────────────────────────────────────────────────────────

/**
 * Returns the company_settings document for the given companyId.
 * If no document exists, inserts defaults and returns them.
 */
export async function getOrCreateCompanySettings(
  db: Db,
  companyId: string
): Promise<CompanySettings> {
  const existing = await db
    .collection<CompanySettings>("company_settings")
    .findOne({ companyId });

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...settings } = existing as CompanySettings & { _id: unknown };
    return settings;
  }

  return createDefaultCompanySettings(db, companyId);
}

// ─── Create defaults ──────────────────────────────────────────────────────────

/**
 * Inserts default company settings and returns the created document.
 * Safe to call multiple times — uses upsert to avoid duplicates.
 */
export async function createDefaultCompanySettings(
  db: Db,
  companyId: string
): Promise<CompanySettings> {
  const now = new Date().toISOString();

  const settings: CompanySettings = {
    ...DEFAULT_COMPANY_SETTINGS,
    companyId,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("company_settings").updateOne(
    { companyId },
    { $setOnInsert: settings },
    { upsert: true }
  );

  // Return the authoritative document from DB
  const doc = await db.collection<CompanySettings>("company_settings").findOne({ companyId });
  if (!doc) return settings; // fallback (extremely unlikely)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...clean } = doc as CompanySettings & { _id: unknown };
  return clean;
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Partially updates company settings.
 * Returns the updated document.
 */
export async function updateCompanySettings(
  db: Db,
  companyId: string,
  patch: Partial<Omit<CompanySettings, "companyId" | "createdAt">>
): Promise<CompanySettings> {
  const now = new Date().toISOString();

  await db.collection("company_settings").updateOne(
    { companyId },
    { $set: { ...patch, updatedAt: now } },
    { upsert: true }
  );

  return getOrCreateCompanySettings(db, companyId);
}
