import { getDb } from "../mongodb";
import { OperationalHealthScore, Shipment, RoutePrediction } from "../types";

export class HealthScore {

  /**
   * DETERMINISTIC INTELLIGENCE ENGINE
   * 
   * Dynamically computes the Operational Health Score for a company.
   * This is a purely deterministic rules engine driven by actual database 
   * state (active shipments, delayed shipments, active drivers, etc.).
   * It does NOT use LLMs or generative AI.
   */
  static async calculateForCompany(companyId: string): Promise<OperationalHealthScore> {
    const db = await getDb();
    
    // 1. Fetch active shipments
    const shipments = await db.collection("shipments").find({
      companyId,
      status: { $in: ["planned", "in_transit", "at-risk"] }
    }).toArray();
    
    const activeShipments = shipments.length;

    let averageRisk = 0;
    let routeConfidence = 100;
    let delayedShipments = 0;
    let totalRisk = 0;
    let totalConfidence = 0;

    for (const s of shipments) {
      const shipment = s as unknown as Shipment;
      // Get latest prediction
      const prediction = await db.collection("route_predictions")
        .findOne({ shipmentId: shipment.id }, { sort: { timestamp: -1 } }) as unknown as RoutePrediction;
      
      if (prediction) {
        totalRisk += (100 - prediction.overallOperationalConfidence);
        totalConfidence += prediction.overallOperationalConfidence;
        if (prediction.delayProbability > 50) {
          delayedShipments++;
        }
      } else {
        totalRisk += shipment.riskScore || 0;
        totalConfidence += 100 - (shipment.riskScore || 0);
      }
    }

    if (activeShipments > 0) {
      averageRisk = totalRisk / activeShipments;
      routeConfidence = totalConfidence / activeShipments;
    } else {
      averageRisk = 10; // Base baseline
      routeConfidence = 90;
    }

    // 2. Fetch workforce availability
    const totalDrivers = await db.collection("drivers").countDocuments({ companyId, status: { $ne: "suspended" } });
    const activeDrivers = await db.collection("drivers").countDocuments({ companyId, status: "active" });
    const driverAvailability = totalDrivers > 0 ? (activeDrivers / totalDrivers) * 100 : 100;

    const totalVehicles = await db.collection("vehicles").countDocuments({ companyId, status: { $ne: "inactive" } });
    const activeVehicles = await db.collection("vehicles").countDocuments({ companyId, status: { $in: ["available", "assigned"] } });
    const vehicleAvailability = totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 100;

    // 3. Incident Density
    const activeIncidents = await db.collection("incidents").countDocuments({ 
      $or: [{ companyId }, { companyId: { $exists: false } }, { companyId: null }] 
    });
    // Arbitrary scaling: 10 incidents = 100 density
    const incidentDensity = Math.min(100, activeIncidents * 10);

    // 4. Calculate Final Score (0-100)
    // Formula weighting:
    // Risk (inverse): 30%
    // Route Confidence: 20%
    // Driver Availability: 15%
    // Vehicle Availability: 15%
    // Delayed Shipments (inverse): 10%
    // Incident Density (inverse): 10%
    
    const delayedPenalty = activeShipments > 0 ? (delayedShipments / activeShipments) * 100 : 0;
    
    let score = (
      ((100 - averageRisk) * 0.3) +
      (routeConfidence * 0.2) +
      (driverAvailability * 0.15) +
      (vehicleAvailability * 0.15) +
      ((100 - delayedPenalty) * 0.1) +
      ((100 - incidentDensity) * 0.1)
    );
    
    score = Math.max(0, Math.min(100, Math.round(score)));

    let status: OperationalHealthScore["status"] = "Excellent";
    if (score < 30) status = "Critical";
    else if (score < 50) status = "Poor";
    else if (score < 75) status = "Fair";
    else if (score < 90) status = "Good";

    const result: OperationalHealthScore = {
      companyId,
      score,
      status,
      activeShipments,
      averageRisk: Math.round(averageRisk),
      driverAvailability: Math.round(driverAvailability),
      vehicleAvailability: Math.round(vehicleAvailability),
      incidentDensity: Math.round(incidentDensity),
      routeConfidence: Math.round(routeConfidence),
      delayedShipments,
      complianceScore: 100, // Placeholder for compliance integration
      calculatedAt: new Date().toISOString()
    };

    // Save history
    await db.collection("operational_metrics").insertOne(result);

    return result;
  }
}
