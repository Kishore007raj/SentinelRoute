import { getDb } from "./mongodb";
import { createWorkforceAuditEvent } from "./workforce-audit";
import { OperationalEngine, type OperationalEvent } from "./intelligence/operational-engine";
import { emitToCompany } from "./socket-server";

type EventType = 
  | "SHIPMENT_CREATED"
  | "SHIPMENT_UPDATED"
  | "SHIPMENT_STATUS"
  | "INCIDENT_REPORTED"
  | "INCIDENT_UPDATED"
  | "VEHICLE_UPDATED"
  | "DRIVER_UPDATED"
  | "WORKFORCE_UPDATED"
  | "COMPANY_SETTINGS_UPDATED"
  | "USER_REGISTERED"
  // Module 9 events
  | "REPORT_GENERATED"
  | "ANALYTICS_EXPORTED"
  | "KPI_UPDATED"
  | "FEED_UPDATED"
  | "HEALTH_UPDATED"
  | "LOCATION_UPDATED"
  | "INCIDENT_COMMAND_UPDATED"
  | "DECISION_LIFECYCLE_UPDATED";

interface DomainEvent {
  type: EventType;
  companyId: string;
  payload: unknown;
}

/**
 * Dispatches domain events to synchronize state across the platform.
 * Fire-and-forget implementation.
 */
export async function dispatchEvent(event: DomainEvent) {
  // We run this asynchronously so it doesn't block the calling API
  setTimeout(async () => {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error(`[EventDispatcher] Failed handling ${event.type}:`, err);
    }
  }, 0);
}

async function handleEvent(event: DomainEvent) {
  const { type, companyId, payload } = event;
  const db = await getDb();

  console.log(`[EventDispatcher] Handling event: ${type}`);

  switch (type) {
    case "SHIPMENT_UPDATED": {
      // Handled by OperationalEngine below
      break;
    }
    
    case "INCIDENT_REPORTED": {
      // Handled by OperationalEngine below
      break;
    }

    case "VEHICLE_UPDATED": {
      // Sync assignments: if vehicle is out of service, unassign from active shipments
      const { vehicleId, status } = payload as { vehicleId: string; status: string };
      if (status === "maintenance" || status === "inactive") {
        const affectedShipments = await db.collection("shipments").find({
          companyId,
          vehicleId,
          status: { $in: ["planned"] }
        }).toArray();

        for (const shipment of affectedShipments) {
          await db.collection("shipments").updateOne(
            { id: shipment.id },
            { $set: { vehicleId: null, vehicleAssignedAt: null } }
          );
          await createWorkforceAuditEvent({
            db,
            companyId,
            targetType: "vehicle",
            targetId: vehicleId,
            eventType: "vehicle_unassigned",
            actorId: "system",
            details: { shipmentId: shipment.id, reason: `Vehicle status changed to ${status}` }
          });
          // Dispatch shipment update
          dispatchEvent({ type: "SHIPMENT_UPDATED", companyId, payload: { shipmentId: shipment.id } });
        }
      }
      break;
    }

    case "DRIVER_UPDATED": {
      // Sync assignments: if driver is inactive, unassign from active shipments
      const { driverId, status } = payload as { driverId: string; status: string };
      if (status === "inactive" || status === "on_leave") {
        const affectedShipments = await db.collection("shipments").find({
          companyId,
          driverId,
          status: { $in: ["planned"] }
        }).toArray();

        for (const shipment of affectedShipments) {
          await db.collection("shipments").updateOne(
            { id: shipment.id },
            { $set: { driverId: null, driverAssignedAt: null } }
          );
          await createWorkforceAuditEvent({
            db,
            companyId,
            targetType: "driver",
            targetId: driverId,
            eventType: "driver_updated",
            actorId: "system",
            details: { shipmentId: shipment.id, action: "assignment_removed", reason: `Driver status changed to ${status}` }
          });
          // Dispatch shipment update
          dispatchEvent({ type: "SHIPMENT_UPDATED", companyId, payload: { shipmentId: shipment.id } });
        }
      }
      break;
    }
  }

  // ── Operational Intelligence Platform (Module 6) ──
  // Only dispatch to OperationalEngine for event types it handles
  const operationalTypes: EventType[] = ["VEHICLE_UPDATED", "DRIVER_UPDATED", "INCIDENT_REPORTED", "SHIPMENT_UPDATED"];
  if (operationalTypes.includes(type)) {
    await OperationalEngine.processEvent(event as unknown as OperationalEvent);
  }

  // ── Real-Time Operations Platform (Module 7) ──
  // Broadcast the domain event to all clients in the company
  const eventName = type.toLowerCase().replace(/_/g, ":");
  emitToCompany(companyId, eventName, payload);
  
  // Also tell clients to refresh feed/health if something changed
  emitToCompany(companyId, "sync:refresh_feed", {});
}
