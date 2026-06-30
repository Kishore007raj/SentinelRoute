import { getDb } from "../mongodb";
import { Shipment, OperationalRecommendation, RecommendationType, RoutePrediction } from "../types";

export class RecommendationEngine {
  
  /**
   * Evaluates a shipment and its latest prediction to generate actionable recommendations.
   * Deterministic generation.
   */
  static async generateRecommendations(shipment: Shipment, prediction?: RoutePrediction): Promise<OperationalRecommendation[]> {
    const recommendations: OperationalRecommendation[] = [];
    const db = await getDb();
    
    // Check Vehicle Status
    if (shipment.assignedVehicleId) {
      const vehicle = await db.collection("vehicles").findOne({ vehicleId: shipment.assignedVehicleId, companyId: shipment.companyId });
      if (vehicle && (vehicle.status === "maintenance" || vehicle.status === "inactive")) {
        recommendations.push(this.createRecommendation(
          shipment,
          "Replace Vehicle",
          `Assigned vehicle ${vehicle.vehicleNumber} is currently in ${vehicle.status}.`,
          95,
          "high",
          ["Vehicle Assignment", "Dispatch Readiness"],
          ["Time to reassign", "Vehicle availability"],
          "Prevents dispatch failure."
        ));
      }
    } else if (shipment.status === "draft") {
      // If draft (planned) but no vehicle
      recommendations.push(this.createRecommendation(
        shipment,
        "Replace Vehicle", // Assuming we use this for "Assign Vehicle" as well based on available enums
        `No vehicle assigned for planned shipment.`,
        100,
        "high",
        ["Dispatch Readiness"],
        [],
        "Enables dispatch."
      ));
    }

    // Check Driver Status
    if (shipment.assignedDriverId) {
      const driver = await db.collection("drivers").findOne({ driverId: shipment.assignedDriverId, companyId: shipment.companyId });
      if (driver && (driver.status === "inactive" || driver.status === "suspended")) {
        recommendations.push(this.createRecommendation(
          shipment,
          "Reassign Driver",
          `Assigned driver ${driver.fullName} is currently ${driver.status}.`,
          95,
          "high",
          ["Driver Assignment", "Dispatch Readiness"],
          ["Time to reassign", "Driver availability"],
          "Prevents dispatch failure."
        ));
      }
    }

    // Check Prediction Risk
    if (prediction) {
      if (prediction.overallOperationalConfidence < 50) {
        if (shipment.status === "draft") {
          recommendations.push(this.createRecommendation(
            shipment,
            "Delay Dispatch",
            `High risk of delay or disruption (Confidence: ${prediction.overallOperationalConfidence}%). Recommended to wait for conditions to improve.`,
            80,
            "medium",
            ["ETA", "Risk"],
            ["Delayed arrival", "Customer expectation"],
            "Improves safety and avoids active disruptions."
          ));
        } else if (shipment.status === "active" || shipment.status === "at-risk") {
          recommendations.push(this.createRecommendation(
            shipment,
            "Change Route",
            `Current route confidence dropped to ${prediction.overallOperationalConfidence}%. Alternative route recommended.`,
            85,
            "high",
            ["ETA", "Risk", "Distance"],
            ["Potential extra mileage", "New route unfamiliarity"],
            "Avoids active disruptions."
          ));
        }
      }

      if (prediction.disruptionProbability > 70) {
        recommendations.push(this.createRecommendation(
          shipment,
          "Escalate to Operations Manager",
          `Disruption probability is extremely high (${prediction.disruptionProbability}%). Manual intervention required.`,
          90,
          "critical",
          ["Management Attention"],
          ["Management bandwidth"],
          "Ensures human oversight on critical risk."
        ));
      }
    }

    // Save recommendations
    for (const rec of recommendations) {
      await db.collection("operational_recommendations").updateOne(
        { shipmentId: rec.shipmentId, type: rec.type, status: "pending" },
        { $setOnInsert: rec },
        { upsert: true }
      );
    }

    return recommendations;
  }

  private static createRecommendation(
    shipment: Shipment,
    type: RecommendationType,
    reason: string,
    confidence: number,
    severity: "low" | "medium" | "high" | "critical",
    affectedMetrics: string[],
    tradeoffs: string[],
    estimatedImpact: string
  ): OperationalRecommendation {
    return {
      recommendationId: `rec-${shipment.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      shipmentId: shipment.id,
      companyId: shipment.companyId || "system",
      type,
      reason,
      confidence,
      affectedMetrics,
      tradeoffs,
      estimatedImpact,
      severity,
      status: "pending",
      createdAt: new Date().toISOString()
    };
  }
}
