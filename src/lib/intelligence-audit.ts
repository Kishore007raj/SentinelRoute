/**
 * intelligence-audit.ts — Immutable audit trail for Module 3 operational events.
 *
 * Collection: intelligence_audits
 * All records are insert-only (never updated, never deleted).
 * Fire-and-forget writes — failures are logged but never block business operations.
 *
 * Mirrors the pattern from workforce-audit.ts.
 */

import type { Db } from "mongodb";
import { getDb } from "./mongodb";

// ─── Event type registry ──────────────────────────────────────────────────────

export type IntelligenceEventType =
  // Risk events
  | "risk_calculated"
  | "risk_increased"
  | "risk_decreased"
  // Prediction events
  | "delay_prediction_generated"
  | "disruption_prediction_generated"
  | "eta_confidence_updated"
  | "corridor_volatility_updated"
  // Alert events
  | "alert_created"
  | "alert_acknowledged"
  | "alert_resolved"
  // Incident events
  | "incident_detected"
  | "incident_updated"
  | "incident_closed"
  // Routing events
  | "reroute_suggested"
  | "reroute_accepted"
  | "reroute_rejected"
  // Shipment intelligence events
  | "weather_risk_added"
  | "traffic_risk_added"
  | "festival_risk_added"
  | "news_risk_added"
  // Super admin
  | "super_admin_read";

// ─── Audit record shape ───────────────────────────────────────────────────────

export interface IntelligenceAuditRecord {
  auditId:     string;       // "iaudit-<timestamp>-<random5>"
  companyId:   string;
  shipmentId?: string;
  incidentId?: string;
  userId?:     string;
  eventType:   IntelligenceEventType;
  timestamp:   string;       // UTC ISO — immutable
  source:      string;       // "PredictionEngine" | "AlertService" | "NewsIntelligence" | etc.
  metadata:    Record<string, unknown>;
}

// ─── Input interface ──────────────────────────────────────────────────────────

export interface IntelligenceAuditInput {
  companyId:   string;
  eventType:   IntelligenceEventType;
  source:      string;
  shipmentId?: string;
  incidentId?: string;
  userId?:     string;
  metadata?:   Record<string, unknown>;
}

// ─── Core writer ─────────────────────────────────────────────────────────────

/**
 * Inserts an immutable audit record into intelligence_audits.
 * Non-throwing — failures logged, never re-thrown.
 * Always fire-and-forget from callers.
 */
export async function createIntelligenceAudit(
  input: IntelligenceAuditInput
): Promise<void> {
  const { companyId, eventType, source, shipmentId, incidentId, userId, metadata } = input;

  const auditId   = `iaudit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toISOString();

  const record: IntelligenceAuditRecord = {
    auditId,
    companyId,
    eventType,
    timestamp,
    source,
    metadata: metadata ?? {},
    ...(shipmentId && { shipmentId }),
    ...(incidentId && { incidentId }),
    ...(userId     && { userId }),
  };

  try {
    const db: Db = await getDb();
    await db.collection("intelligence_audits").insertOne(record);
  } catch (err) {
    // Audit failures must never crash the main operation
    console.error(
      "[intelligence-audit] Failed to write audit event:",
      eventType,
      companyId,
      err
    );
  }
}
