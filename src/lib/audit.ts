/**
 * audit.ts — Audit event helpers for the company_audits collection.
 *
 * All audit records are immutable insert-only (never updated or deleted).
 * Every major company action must call createAuditEvent().
 *
 * Canonical event types are defined in AuditEventType (types.ts).
 * Legacy free-form eventType strings from the existing register/submit/admin
 * routes remain valid — this helper normalizes new events going forward.
 */

import type { Db } from "mongodb";
import type { AuditEventType } from "@/lib/types";

export interface AuditEventInput {
  db:          Db;
  companyId:   string;
  eventType:   AuditEventType | string; // string for backward compat with legacy events
  performedBy: string;                   // userId of actor
  details?:    Record<string, unknown>;  // optional structured metadata
  description?: string;                 // human-readable summary
}

/**
 * Inserts an immutable audit record into company_audits.
 * Non-throwing — logs errors but never fails the caller.
 */
export async function createAuditEvent(input: AuditEventInput): Promise<void> {
  const { db, companyId, eventType, performedBy, details, description } = input;

  const auditId   = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toISOString();

  const record: Record<string, unknown> = {
    auditId,
    companyId,
    eventType,
    performedBy,
    timestamp,
    // Keep legacy fields for backward compat with existing queries
    actorId:     performedBy,
    description: description ?? String(eventType),
  };

  if (details && Object.keys(details).length > 0) {
    record.details = details;
  }

  try {
    await db.collection("company_audits").insertOne(record);
  } catch (err) {
    // Audit failures must never crash the main operation
    console.error("[audit] Failed to write audit event:", eventType, companyId, err);
  }
}
