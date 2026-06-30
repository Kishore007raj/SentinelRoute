import { getDb } from "../mongodb";
import { DependencyGraph } from "./dependency-graph";
import { RecommendationEngine } from "./recommendation-engine";
import { calculateRoutePrediction } from "../prediction-engine";
import { Shipment, Incident } from "../types";
import { addTimelineEvent } from "../timeline-service";

export type OperationalEvent = 
  | { type: "VEHICLE_UPDATED", companyId: string, payload: { vehicleId: string; status?: string; action?: string; vehicle?: Record<string, unknown> } }
  | { type: "DRIVER_UPDATED", companyId: string, payload: { driverId: string; status?: string; action?: string; driver?: Record<string, unknown> } }
  | { type: "INCIDENT_REPORTED", companyId: string, payload: { incident: Incident } }
  | { type: "SHIPMENT_UPDATED", companyId: string, payload: { shipmentId: string } };

export class OperationalEngine {
  
  /**
   * Processes an operational event, propagates it through the dependency graph,
   * recalculates risk, and generates deterministic recommendations.
   */
  static async processEvent(event: OperationalEvent): Promise<void> {
    const { type, companyId, payload } = event;
    const db = await getDb();
    
    let affectedNodes: Array<{ shipment: Shipment; reason: string }> = [];
    let reason = "";

    switch (type) {
      case "VEHICLE_UPDATED":
        reason = `Vehicle status changed to ${payload.status}`;
        affectedNodes = await DependencyGraph.getShipmentsAffectedByVehicle(companyId, payload.vehicleId, reason);
        break;
      case "DRIVER_UPDATED":
        reason = `Driver status changed to ${payload.status}`;
        affectedNodes = await DependencyGraph.getShipmentsAffectedByDriver(companyId, payload.driverId, reason);
        break;
      case "INCIDENT_REPORTED":
        reason = `New incident: ${payload.incident.title}`;
        affectedNodes = await DependencyGraph.getShipmentsAffectedByIncident(companyId, payload.incident, reason);
        break;
      case "SHIPMENT_UPDATED":
        const s = await db.collection("shipments").findOne({ id: payload.shipmentId, companyId });
        if (s && s.status !== "completed" && s.status !== "cancelled") {
          affectedNodes = [{ shipment: s as unknown as Shipment, reason: "Shipment updated" }];
        }
        break;
    }

    // Propagate and evaluate each affected shipment
    for (const node of affectedNodes) {
      const { shipment } = node;
      
      // 1. Recalculate Risk & ETA
      const prediction = await calculateRoutePrediction(shipment);
      
      // 2. Generate Recommendations
      const recommendations = await RecommendationEngine.generateRecommendations(shipment, prediction);

      // 3. Log to Timeline if recommendations generated
      for (const rec of recommendations) {
        await addTimelineEvent(
          shipment.id,
          companyId,
          "Recommendation Generated",
          `System recommended: ${rec.type}. Reason: ${rec.reason}`,
          "Operational Engine",
          rec.confidence,
          rec.affectedMetrics
        );
      }
    }
    
    // 4. Update Operational Health Score for the company
    // (In a real system, you might throttle this or run it on a cron, but for now we calculate it immediately)
    // We can call HealthScore.calculateForCompany(companyId) here if we want real-time.
  }
}
