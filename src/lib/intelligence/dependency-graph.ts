import { getDb } from "../mongodb";
import { Shipment, Incident } from "../types";

export interface AffectedShipmentNode {
  shipment: Shipment;
  reason: string;
}

/**
 * Traverses the operational dependency graph to find all shipments affected by an event.
 * Vehicle -> Shipment
 * Driver -> Shipment
 * Incident -> Shipment (via Route/Geography)
 */
export class DependencyGraph {
  
  static async getShipmentsAffectedByVehicle(companyId: string, vehicleId: string, reason: string): Promise<AffectedShipmentNode[]> {
    const db = await getDb();
    const shipments = await db.collection("shipments").find({
      companyId,
      assignedVehicleId: vehicleId,
      status: { $in: ["planned", "in_transit", "active", "draft", "at-risk"] }
    }).toArray();
    
    return shipments.map(s => ({ shipment: s as unknown as Shipment, reason }));
  }

  static async getShipmentsAffectedByDriver(companyId: string, driverId: string, reason: string): Promise<AffectedShipmentNode[]> {
    const db = await getDb();
    const shipments = await db.collection("shipments").find({
      companyId,
      assignedDriverId: driverId,
      status: { $in: ["planned", "in_transit", "active", "draft", "at-risk"] }
    }).toArray();
    
    return shipments.map(s => ({ shipment: s as unknown as Shipment, reason }));
  }

  static async getShipmentsAffectedByIncident(companyId: string, incident: Incident, reason: string): Promise<AffectedShipmentNode[]> {
    const db = await getDb();
    // For V1, we flag all active shipments in the company. 
    // In production, we'd do geospatial intersection of shipment route geometries with the incident radius.
    const shipments = await db.collection("shipments").find({
      companyId,
      status: { $in: ["planned", "in_transit", "active", "draft", "at-risk"] }
    }).toArray();
    
    return shipments.map(s => ({ shipment: s as unknown as Shipment, reason }));
  }
}
