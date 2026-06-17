/**
 * mongodb-indexes.ts — Idempotent index creation for all Module 1 collections.
 *
 * MongoDB's createIndex() is idempotent by design:
 *   - If the index already exists with the same spec and options, it is a no-op.
 *   - If an index exists with the same name but different spec, MongoDB throws —
 *     that would indicate a programming error and is the correct behaviour.
 *
 * Called once per process from ensureIndexes(), which is guarded by a flag so it
 * only runs on the first getDb() call. Never blocks a request — runs fire-and-forget
 * after the first DB connection is established.
 *
 * DO NOT modify collection schemas here. Index definitions only.
 */

import type { Db } from "mongodb";

// ─── Guard: run only once per process ────────────────────────────────────────

let indexesEnsured = false;

export async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;

  try {
    await Promise.all([
      ensureCompaniesIndexes(db),
      ensureUsersIndexes(db),
      ensureShipmentsIndexes(db),
      ensureCompanyDocumentsIndexes(db),
      ensureCompanyAuditsIndexes(db),
      ensureCompanySettingsIndexes(db),
    ]);
    console.log("[mongodb-indexes] All indexes ensured.");
  } catch (err) {
    // Index creation failure must never crash the application.
    // Log and continue — the app functions without indexes, just slower.
    console.error("[mongodb-indexes] Failed to ensure indexes:", err);
  }
}

// ─── companies ────────────────────────────────────────────────────────────────

async function ensureCompaniesIndexes(db: Db): Promise<void> {
  const col = db.collection("companies");
  await Promise.all([
    // Primary lookup key — must be unique
    col.createIndex(
      { companyId: 1 },
      { unique: true, name: "companies_companyId_unique", background: true }
    ),
    // Admin panel filters companies by status
    col.createIndex(
      { status: 1 },
      { name: "companies_status", background: true }
    ),
    // Sort by creation date on admin list view
    col.createIndex(
      { createdAt: -1 },
      { name: "companies_createdAt_desc", background: true }
    ),
  ]);
}

// ─── users ────────────────────────────────────────────────────────────────────

async function ensureUsersIndexes(db: Db): Promise<void> {
  const col = db.collection("users");
  await Promise.all([
    // Every authenticated API call looks up the user by Firebase UID
    col.createIndex(
      { userId: 1 },
      { unique: true, name: "users_userId_unique", background: true }
    ),
    // Shipment and company queries need all users for a given company
    col.createIndex(
      { companyId: 1 },
      { name: "users_companyId", background: true }
    ),
    // Role-based lookups (e.g. find all company_admin for a company)
    col.createIndex(
      { role: 1 },
      { name: "users_role", background: true }
    ),
    // Super admin email lookup used by /api/company/me self-healing
    col.createIndex(
      { email: 1 },
      { name: "users_email", background: true }
    ),
    // Compound: find active users within a company by role
    col.createIndex(
      { companyId: 1, role: 1 },
      { name: "users_companyId_role", background: true }
    ),
  ]);
}

// ─── shipments ────────────────────────────────────────────────────────────────

async function ensureShipmentsIndexes(db: Db): Promise<void> {
  const col = db.collection("shipments");
  await Promise.all([
    // Primary tenant isolation — all shipment reads filter by companyId
    col.createIndex(
      { companyId: 1 },
      { name: "shipments_companyId", background: true }
    ),
    // Ownership field added in Module 1 Task 5
    col.createIndex(
      { createdByUserId: 1 },
      { name: "shipments_createdByUserId", background: true }
    ),
    // Dashboard and list views filter by status
    col.createIndex(
      { status: 1 },
      { name: "shipments_status", background: true }
    ),
    // Default sort on GET /api/shipments is createdAt desc
    col.createIndex(
      { createdAt: -1 },
      { name: "shipments_createdAt_desc", background: true }
    ),
    // Compound: company-scoped shipment list sorted by date (covers the main query)
    col.createIndex(
      { companyId: 1, createdAt: -1 },
      { name: "shipments_companyId_createdAt", background: true }
    ),
    // PATCH /api/shipments/[id] filters by { id, companyId }
    col.createIndex(
      { id: 1, companyId: 1 },
      { name: "shipments_id_companyId", background: true }
    ),
    // Legacy fallback: { id, userId } filter for pre-Module 1 shipments
    col.createIndex(
      { id: 1, userId: 1 },
      { name: "shipments_id_userId", background: true }
    ),
  ]);
}

// ─── company_documents ───────────────────────────────────────────────────────

async function ensureCompanyDocumentsIndexes(db: Db): Promise<void> {
  const col = db.collection("company_documents");
  await Promise.all([
    // All document reads filter by companyId
    col.createIndex(
      { companyId: 1 },
      { name: "company_documents_companyId", background: true }
    ),
    // Upsert uses { companyId, type } as the filter key
    col.createIndex(
      { companyId: 1, type: 1 },
      { unique: true, name: "company_documents_companyId_type_unique", background: true }
    ),
  ]);
}

// ─── company_audits ──────────────────────────────────────────────────────────

async function ensureCompanyAuditsIndexes(db: Db): Promise<void> {
  const col = db.collection("company_audits");
  await Promise.all([
    // All audit reads filter by companyId
    col.createIndex(
      { companyId: 1 },
      { name: "company_audits_companyId", background: true }
    ),
    // Audit log is displayed sorted by timestamp desc
    col.createIndex(
      { timestamp: -1 },
      { name: "company_audits_timestamp_desc", background: true }
    ),
    // Compound: company-scoped audit timeline (covers both filters at once)
    col.createIndex(
      { companyId: 1, timestamp: -1 },
      { name: "company_audits_companyId_timestamp", background: true }
    ),
    // Filter audits by event type
    col.createIndex(
      { eventType: 1 },
      { name: "company_audits_eventType", background: true }
    ),
  ]);
}

// ─── company_settings ────────────────────────────────────────────────────────

async function ensureCompanySettingsIndexes(db: Db): Promise<void> {
  const col = db.collection("company_settings");
  await Promise.all([
    // Unique: one settings document per company, upsert key
    col.createIndex(
      { companyId: 1 },
      { unique: true, name: "company_settings_companyId_unique", background: true }
    ),
    // Language-based lookups for multilingual routing
    col.createIndex(
      { language: 1 },
      { name: "company_settings_language", background: true }
    ),
  ]);
}
