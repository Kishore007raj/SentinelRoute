import { getDb } from "./mongodb";
import { utcNow } from "./time";
import { emitToCompany } from "./socket-server";
import { addTimelineEvent } from "./timeline-service";
import type { IncidentTimelineEvent, AppNotification, OperationalAlert } from "./types";

export interface EscalationResult {
  breachedSlaCount: number;
  idleAlertCount: number;
  corridorBreachCount: number;
  evaluatedAt: string;
}

/**
 * Evaluates all active incidents and shipments for a company against automated escalation rules.
 */
export async function runCompanyEscalationRules(companyId?: string): Promise<EscalationResult> {
  const db = await getDb();
  const now = utcNow();
  const query: Record<string, unknown> = companyId ? { companyId } : {};

  let breachedSlaCount = 0;
  let idleAlertCount = 0;
  let corridorBreachCount = 0;

  // ── Rule 1: SLA Deadline Breaches ──────────────────────────────────────────
  const breachedIncidents = await db.collection("incidents").find({
    ...query,
    slaDeadline: { $lt: now },
    slaBreached: { $ne: true },
    commandStatus: { $nin: ["resolved"] },
  }).toArray();

  for (const incident of breachedIncidents) {
    const newLevel = Math.min((incident.escalationLevel ?? 0) + 1, 3);
    const timelineEvent: IncidentTimelineEvent = {
      eventType: "escalated",
      timestamp: now,
      note: `SLA deadline breached (${new Date(incident.slaDeadline).toLocaleTimeString()}) — auto-escalated to Level ${newLevel}`,
    };

    await db.collection("incidents").updateOne(
      { incidentId: incident.incidentId },
      {
        $set: {
          slaBreached: true,
          escalationLevel: newLevel,
          severity: "critical",
          lastUpdated: now,
        },
        $push: { timeline: timelineEvent as any },
      }
    );

    // Create persistent app notification
    const notification: AppNotification = {
      id: `notif-esc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      companyId: incident.companyId,
      userId: incident.assignedToId || "all",
      type: "incident_reported",
      severity: "critical",
      title: `🚨 Incident Escalated: ${incident.title}`,
      message: `SLA breached. Severity elevated to critical. Immediate response required.`,
      metadata: { incidentId: incident.incidentId, escalationLevel: newLevel },
      read: false,
      createdAt: now,
    };
    await db.collection("notifications").insertOne(notification);

    if (incident.relatedShipmentId) {
      await addTimelineEvent(
        incident.relatedShipmentId,
        incident.companyId,
        "Risk Escalated",
        `Incident SLA breached. Escalated to Level ${newLevel}.`,
        "Escalation Rules Engine",
        100
      );
    }

    emitToCompany(incident.companyId, "incident:escalated", {
      incidentId: incident.incidentId,
      escalationLevel: newLevel,
      severity: "critical"
    });

    breachedSlaCount++;
  }

  // ── Rule 2: Stopped / Idle Vehicle Detection (>45 mins in driving status) ─
  const fortyFiveMinutesAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const stagnantExecutions = await db.collection("shipment_executions").find({
    ...query,
    status: "driving",
    lastUpdated: { $lt: fortyFiveMinutesAgo },
  }).toArray();

  for (const execution of stagnantExecutions) {
    // Verify we haven't already generated an alert for this execution in the past 2 hours
    const existingAlert = await db.collection("operational_alerts").findOne({
      shipmentId: execution.shipmentId,
      reason: { $regex: "Vehicle Stoppage Detected" },
      timestamp: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    });

    if (!existingAlert) {
      const alert: OperationalAlert = {
        alertId: `alert-stagnant-${execution.shipmentId}-${Date.now()}`,
        shipmentId: execution.shipmentId,
        companyId: execution.companyId,
        driverId: execution.driverId,
        vehicleId: execution.vehicleId,
        category: "Execution",
        severity: "high",
        confidence: 95,
        status: "active",
        reason: "Vehicle Stoppage Detected (>45 mins without location update)",
        recommendedAction: "Contact driver immediately or dispatch roadside assistance.",
        timestamp: now,
      };

      await db.collection("operational_alerts").insertOne(alert);

      await addTimelineEvent(
        execution.shipmentId,
        execution.companyId,
        "System Alert",
        "Vehicle stagnant: no GPS update for >45 minutes during active trip.",
        "Escalation Rules Engine",
        95
      );

      emitToCompany(execution.companyId, "alert:new", alert);
      idleAlertCount++;
    }
  }

  // ── Rule 3: Corridor Breach Checks in Active Executions ─────────────────────
  const breachIncidents = await db.collection("operational_alerts").find({
    ...query,
    category: "Route",
    status: "active",
    timestamp: { $gte: fortyFiveMinutesAgo },
  }).toArray();
  corridorBreachCount = breachIncidents.length;

  return {
    breachedSlaCount,
    idleAlertCount,
    corridorBreachCount,
    evaluatedAt: now,
  };
}
