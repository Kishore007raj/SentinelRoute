import { calculateRoutePrediction } from "./prediction-engine";
import { getDb } from "./mongodb";
import { createWorkforceAuditEvent } from "./workforce-audit";

type EventType = 
  | "SHIPMENT_UPDATED"
  | "INCIDENT_REPORTED"
  | "VEHICLE_UPDATED"
  | "DRIVER_UPDATED";

interface DomainEvent {
  type: EventType;
  companyId: string;
  payload: any;
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
      // Re-run prediction engine for this shipment
      const shipmentId = payload.shipmentId;
      const shipment = await db.collection("shipments").findOne({ id: shipmentId, companyId });
      if (shipment && shipment.status !== "completed") {
        await calculateRoutePrediction(shipment as any);
      }
      break;
    }
    
    case "INCIDENT_REPORTED": {
      // Find all active shipments in the affected area or just all active shipments and recalculate predictions
      const activeShipments = await db.collection("shipments").find({ 
        companyId, 
        status: { $in: ["planned", "in_transit"] } 
      }).toArray();
      
      for (const shipment of activeShipments) {
        await calculateRoutePrediction(shipment as any);
      }
      break;
    }

    case "VEHICLE_UPDATED": {
      // Sync assignments: if vehicle is out of service, unassign from active shipments
      const { vehicleId, status } = payload;
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
      const { driverId, status } = payload;
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
}
