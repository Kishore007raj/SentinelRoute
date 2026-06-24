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
      // Module 3
      ensureIncidentsIndexes(db),
      ensureIncidentEventsIndexes(db),
      ensureRoutePredictionsIndexes(db),
      ensureRiskCalculationsIndexes(db),
      ensureShipmentTimelinesIndexes(db),
      ensureCorridorStatisticsIndexes(db),
      ensureShipmentChannelsIndexes(db),
      ensureShipmentMessagesIndexes(db),
      ensureOperationalAlertsIndexes(db),
      ensureIntelligenceAuditsIndexes(db),
      ensureFestivalCalendarIndexes(db),
    ]);
    console.log("[mongodb-indexes] All indexes ensured.");
  } catch (err) {
    // Index creation failure must never crash the application.
    // Log and continue — the app functions without indexes, just slower.
    console.error("[mongodb-indexes] Failed to ensure indexes:", err);
  }
}

// ─── Module 3 ─────────────────────────────────────────────────────────────────

async function ensureIncidentsIndexes(db: Db): Promise<void> {
  const col = db.collection("incidents");
  await Promise.all([
    col.createIndex({ incidentId: 1 }, { unique: true, name: "incidents_id_unique", background: true }),
    col.createIndex({ companyId: 1 }, { name: "incidents_companyId", background: true }),
    // Geo index for Map
    col.createIndex({ "latitude": 1, "longitude": 1 }, { name: "incidents_geo", background: true }),
    col.createIndex({ startTime: -1 }, { name: "incidents_startTime_desc", background: true }),
    col.createIndex({ category: 1 }, { name: "incidents_category", background: true }),
  ]);
}

async function ensureRoutePredictionsIndexes(db: Db): Promise<void> {
  const col = db.collection("route_predictions");
  await Promise.all([
    col.createIndex({ predictionId: 1 }, { unique: true, name: "predictions_id_unique", background: true }),
    col.createIndex({ shipmentId: 1 }, { name: "predictions_shipmentId", background: true }),
    col.createIndex({ companyId: 1 }, { name: "predictions_companyId", background: true }),
    col.createIndex({ timestamp: -1 }, { name: "predictions_timestamp_desc", background: true }),
    col.createIndex({ createdAt: -1 }, { name: "predictions_createdAt_desc", background: true }),
    col.createIndex(
      { companyId: 1, shipmentId: 1, createdAt: -1 },
      { name: "predictions_company_shipment_created", background: true }
    ),
  ]);
}

async function ensureShipmentTimelinesIndexes(db: Db): Promise<void> {
  const col = db.collection("shipment_timelines");
  await Promise.all([
    col.createIndex({ eventId: 1 }, { unique: true, name: "timelines_id_unique", background: true }),
    col.createIndex({ shipmentId: 1, timestamp: -1 }, { name: "timelines_shipmentId_timestamp", background: true }),
    col.createIndex({ companyId: 1 }, { name: "timelines_companyId", background: true }),
  ]);
}

async function ensureCorridorStatisticsIndexes(db: Db): Promise<void> {
  const col = db.collection("corridor_statistics");
  await Promise.all([
    col.createIndex({ corridorId: 1 }, { unique: true, name: "corridors_id_unique", background: true }),
    col.createIndex({ origin: 1, destination: 1 }, { name: "corridors_origin_dest", background: true }),
  ]);
}

async function ensureShipmentChannelsIndexes(db: Db): Promise<void> {
  const col = db.collection("shipment_channels");
  await Promise.all([
    col.createIndex({ channelId: 1 }, { unique: true, name: "channels_id_unique", background: true }),
    col.createIndex({ shipmentId: 1 }, { unique: true, name: "channels_shipmentId_unique", background: true }),
    col.createIndex({ companyId: 1 }, { name: "channels_companyId", background: true }),
  ]);
}

async function ensureShipmentMessagesIndexes(db: Db): Promise<void> {
  const col = db.collection("shipment_messages");
  await Promise.all([
    col.createIndex({ messageId: 1 }, { unique: true, name: "messages_id_unique", background: true }),
    col.createIndex({ channelId: 1, timestamp: 1 }, { name: "messages_channel_timestamp", background: true }),
    col.createIndex({ shipmentId: 1 }, { name: "messages_shipmentId", background: true }),
  ]);
}

async function ensureOperationalAlertsIndexes(db: Db): Promise<void> {
  const col = db.collection("operational_alerts");
  await Promise.all([
    col.createIndex({ alertId: 1 }, { unique: true, name: "alerts_id_unique", background: true }),
    col.createIndex({ shipmentId: 1 }, { name: "alerts_shipmentId", background: true }),
    col.createIndex({ companyId: 1, timestamp: -1 }, { name: "alerts_companyId_timestamp", background: true }),
    col.createIndex({ status: 1 }, { name: "alerts_status", background: true }),
    col.createIndex({ severity: 1 }, { name: "alerts_severity", background: true }),
    col.createIndex(
      { companyId: 1, status: 1, severity: 1 },
      { name: "alerts_company_status_severity", background: true }
    ),
  ]);
}

// ─── incident_events (Task 7 — Module 3 Finalization) ────────────────────────

async function ensureIncidentEventsIndexes(db: Db): Promise<void> {
  const col = db.collection("incident_events");
  await Promise.all([
    col.createIndex({ incidentId: 1 }, { unique: true, name: "incident_events_id_unique", background: true }),
    col.createIndex({ companyId: 1 }, { name: "incident_events_companyId", background: true }),
    col.createIndex({ severity: 1 }, { name: "incident_events_severity", background: true }),
    col.createIndex({ startTime: -1 }, { name: "incident_events_startTime_desc", background: true }),
    col.createIndex({ shipmentId: 1 }, { name: "incident_events_shipmentId", background: true }),
    col.createIndex({ createdAt: -1 }, { name: "incident_events_createdAt_desc", background: true }),
    col.createIndex(
      { companyId: 1, severity: 1, startTime: -1 },
      { name: "incident_events_companyId_severity_time", background: true }
    ),
    col.createIndex(
      { companyId: 1, shipmentId: 1, severity: 1, createdAt: -1 },
      { name: "incident_events_company_shipment_severity_created", background: true }
    ),
  ]);
}

// ─── risk_calculations (Task 7 — Module 3 Finalization) ──────────────────────

async function ensureRiskCalculationsIndexes(db: Db): Promise<void> {
  const col = db.collection("risk_calculations");
  await Promise.all([
    col.createIndex({ calculationId: 1 }, { unique: true, name: "risk_calc_id_unique", background: true }),
    col.createIndex({ companyId: 1 }, { name: "risk_calc_companyId", background: true }),
    col.createIndex({ shipmentId: 1 }, { name: "risk_calc_shipmentId", background: true }),
    col.createIndex({ createdAt: -1 }, { name: "risk_calc_createdAt_desc", background: true }),
    col.createIndex(
      { companyId: 1, shipmentId: 1, createdAt: -1 },
      { name: "risk_calc_companyId_shipmentId_time", background: true }
    ),
  ]);
}

// ─── intelligence_audits (Task 1 — Module 3 Finalization) ────────────────────

async function ensureIntelligenceAuditsIndexes(db: Db): Promise<void> {
  const col = db.collection("intelligence_audits");
  await Promise.all([
    col.createIndex({ auditId: 1 }, { unique: true, name: "intel_audit_id_unique", background: true }),
    col.createIndex({ companyId: 1, timestamp: -1 }, { name: "intel_audit_companyId_time", background: true }),
    col.createIndex({ shipmentId: 1 }, { name: "intel_audit_shipmentId", background: true }),
    col.createIndex({ eventType: 1 }, { name: "intel_audit_eventType", background: true }),
    col.createIndex(
      { companyId: 1, eventType: 1, timestamp: -1 },
      { name: "intel_audit_companyId_eventType_time", background: true }
    ),
  ]);
}

// ─── festival_calendar (Task 4 — Module 3 Finalization) ──────────────────────

async function ensureFestivalCalendarIndexes(db: Db): Promise<void> {
  const col = db.collection("festival_calendar");
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true, name: "festival_id_unique", background: true }),
    col.createIndex({ state: 1 }, { name: "festival_state", background: true }),
    col.createIndex({ startDate: 1, endDate: 1 }, { name: "festival_date_range", background: true }),
    col.createIndex({ riskLevel: 1 }, { name: "festival_riskLevel", background: true }),
  ]);
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
    // Multilingual: resolve preferred language for notifications
    col.createIndex(
      { preferredLanguage: 1 },
      { name: "users_preferredLanguage", background: true }
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
