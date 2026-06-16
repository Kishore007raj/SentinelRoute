/**
 * workforce-audit.ts — Audit event helpers for the workforce_audits collection.
 *
 * All audit records are immutable insert-only (never updated or deleted).
 * Every workforce operation must call createWorkforceAuditEvent().
 *
 * This file is standalone — it does NOT import from or modify src/lib/audit.ts.
 * Pattern mirrors createAuditEvent from src/lib/audit.ts exactly.
 */

import type { Db } from "mongodb";

// ─── Event Types ──────────────────────────────────────────────────────────────

export type WorkforceEventType =
  | "driver_created"
  | "driver_updated"
  | "driver_suspended"
  | "driver_activated"
  | "vehicle_added"
  | "vehicle_updated"
  | "vehicle_assigned"
  | "vehicle_unassigned"
  | "vehicle_maintenance"
  | "vehicle_activated"
  | "user_invited"
  | "user_disabled"
  | "user_activated"
  | "user_role_changed"
  | "super_admin_read";

// ─── Input Interface ─────────────────────────────────────────────────────────

export interface WorkforceAuditInput {
  db:         Db;
  companyId:  string;
  eventType:  WorkforceEventType;
  actorId:    string;       // authenticated userId
  targetId:   string;       // driverId | vehicleId | userId
  targetType: "driver" | "vehicle" | "user";
  details?:   Record<string, unknown>;
}

// ─── Audit Record Shape ───────────────────────────────────────────────────────

interface WorkforceAuditRecord {
  auditId:    string;
  companyId:  string;
  eventType:  WorkforceEventType;
  actorId:    string;
  targetId:   string;
  targetType: "driver" | "vehicle" | "user";
  details:    Record<string, unknown>;
  timestamp:  string;  // UTC ISO — immutable, never updated
}

// ─── createWorkforceAuditEvent ────────────────────────────────────────────────

/**
 * Inserts an immutable record into workforce_audits.
 * Non-throwing — logs errors but never fails the caller.
 * Pattern mirrors createAuditEvent from src/lib/audit.ts.
 */
export async function createWorkforceAuditEvent(
  input: WorkforceAuditInput
): Promise<void> {
  const { db, companyId, eventType, actorId, targetId, targetType, details } = input;

  const auditId   = `waudit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toISOString();

  const record: WorkforceAuditRecord = {
    auditId,
    companyId,
    eventType,
    actorId,
    targetId,
    targetType,
    details: details ?? {},
    timestamp,
  };

  try {
    await db.collection("workforce_audits").insertOne(record);
  } catch (err) {
    // Audit failures must never crash the main operation
    console.error(
      "[workforce-audit] Failed to write audit event:",
      eventType,
      companyId,
      err
    );
  }
}
