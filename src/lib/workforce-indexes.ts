/**
 * workforce-indexes.ts — Idempotent index creation for all Module 2 collections.
 *
 * MongoDB's createIndex() is idempotent by design:
 *   - If the index already exists with the same spec and options, it is a no-op.
 *   - If an index exists with the same name but different spec, MongoDB throws —
 *     that would indicate a programming error and is the correct behaviour.
 *
 * Called once per process from ensureWorkforceIndexes(), guarded by a boolean flag.
 * Triggered automatically via getDb() in mongodb.ts — runs once per cold start,
 * never blocks a request. Index creation failure is logged but never crashes the server.
 *
 * Collections covered:
 *   drivers, vehicles, company_users, workforce_audits
 *
 * DO NOT modify collection schemas here. Index definitions only.
 */

import type { Db } from "mongodb";

// ─── Guard: run only once per process ────────────────────────────────────────

let indexesEnsured = false;

/**
 * Creates all MongoDB indexes for the four Module 2 workforce collections.
 * Safe to call multiple times — runs only on the first invocation per process.
 * Wraps all index creation in a try/catch; failures are logged, never re-thrown.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export async function ensureWorkforceIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;

  try {
    await Promise.all([
      ensureDriversIndexes(db),
      ensureVehiclesIndexes(db),
      ensureCompanyUsersIndexes(db),
      ensureWorkforceAuditsIndexes(db),
    ]);
    console.log("[workforce-indexes] All workforce indexes ensured.");
  } catch (err) {
    // Index creation failure must never crash the application.
    // Log and continue — the app functions without indexes, just slower.
    console.error("[workforce-indexes] Failed to ensure workforce indexes:", err);
    // Reset flag so next request retries index creation.
    indexesEnsured = false;
  }
}

// ─── drivers ─────────────────────────────────────────────────────────────────

async function ensureDriversIndexes(db: Db): Promise<void> {
  const col = db.collection("drivers");
  await Promise.all([
    // Tenant isolation — all driver queries filter by companyId
    col.createIndex(
      { companyId: 1 },
      { name: "drivers_companyId", background: true }
    ),
    // Status-filtered list queries (e.g. GET ?status=active)
    col.createIndex(
      { companyId: 1, status: 1 },
      { name: "drivers_companyId_status", background: true }
    ),
    // Primary point-lookup key — must be unique
    col.createIndex(
      { driverId: 1 },
      { unique: true, name: "drivers_driverId_unique", background: true }
    ),
    // Task 8: compound for GET /api/workforce/drivers/[id] filter {driverId, companyId}
    col.createIndex(
      { driverId: 1, companyId: 1 },
      { name: "drivers_driverId_companyId", background: true }
    ),
    // Dashboard upcoming expirations query filters by licenseExpiry
    col.createIndex(
      { companyId: 1, licenseExpiry: 1 },
      { name: "drivers_companyId_licenseExpiry", background: true }
    ),
  ]);
}

// ─── vehicles ─────────────────────────────────────────────────────────────────

async function ensureVehiclesIndexes(db: Db): Promise<void> {
  const col = db.collection("vehicles");
  await Promise.all([
    // Tenant isolation — all vehicle queries filter by companyId
    col.createIndex(
      { companyId: 1 },
      { name: "vehicles_companyId", background: true }
    ),
    // Status-filtered list queries and status count aggregations
    col.createIndex(
      { companyId: 1, status: 1 },
      { name: "vehicles_companyId_status", background: true }
    ),
    // Primary point-lookup key — must be unique
    col.createIndex(
      { vehicleId: 1 },
      { unique: true, name: "vehicles_vehicleId_unique", background: true }
    ),
    // Task 8: compound for GET /api/workforce/vehicles/[id] filter {vehicleId, companyId}
    col.createIndex(
      { vehicleId: 1, companyId: 1 },
      { name: "vehicles_vehicleId_companyId", background: true }
    ),
    // Dashboard upcoming expirations — insurance
    col.createIndex(
      { companyId: 1, insuranceExpiry: 1 },
      { name: "vehicles_companyId_insuranceExpiry", background: true }
    ),
    // Dashboard upcoming expirations — permit
    col.createIndex(
      { companyId: 1, permitExpiry: 1 },
      { name: "vehicles_companyId_permitExpiry", background: true }
    ),
    // Dashboard upcoming expirations — fitness certificate
    col.createIndex(
      { companyId: 1, fitnessExpiry: 1 },
      { name: "vehicles_companyId_fitnessExpiry", background: true }
    ),
  ]);
}

// ─── company_users ────────────────────────────────────────────────────────────

async function ensureCompanyUsersIndexes(db: Db): Promise<void> {
  const col = db.collection("company_users");
  await Promise.all([
    // All user-management queries scope to a company
    col.createIndex(
      { companyId: 1 },
      { name: "company_users_companyId", background: true }
    ),
    // Auth helpers look up a user record by Firebase UID
    col.createIndex(
      { userId: 1 },
      { name: "company_users_userId", background: true }
    ),
    // Unique: one binding per (company, user) pair; also the primary upsert key
    col.createIndex(
      { companyId: 1, userId: 1 },
      { unique: true, name: "company_users_companyId_userId_unique", background: true }
    ),
  ]);
}

// ─── workforce_audits ─────────────────────────────────────────────────────────

async function ensureWorkforceAuditsIndexes(db: Db): Promise<void> {
  const col = db.collection("workforce_audits");
  await Promise.all([
    // Dashboard recent-activity query: company-scoped, sorted by timestamp desc
    col.createIndex(
      { companyId: 1, timestamp: -1 },
      { name: "workforce_audits_companyId_timestamp_desc", background: true }
    ),
    // Profile-page audit history: all audits for a specific target within a company
    col.createIndex(
      { companyId: 1, targetId: 1 },
      { name: "workforce_audits_companyId_targetId", background: true }
    ),
    // Primary point-lookup key — must be unique (immutable records)
    col.createIndex(
      { auditId: 1 },
      { unique: true, name: "workforce_audits_auditId_unique", background: true }
    ),
    // Task 8: filter by event type for future audit filtering features
    col.createIndex(
      { eventType: 1 },
      { name: "workforce_audits_eventType", background: true }
    ),
  ]);
}
