import { getDb } from "./mongodb";
import { OperationalAlert, RoutePrediction, Shipment } from "./types";

/**
 * Analyzes a new route prediction and generates operational alerts if necessary.
 */
export async function evaluateAlerts(shipment: Shipment, prediction: RoutePrediction): Promise<OperationalAlert | null> {
  let alertReason = null;
  let recommendedAction = "Monitor closely";
  
  if (prediction.delayProbability > 70) {
    alertReason = "High Delay Probability Detected";
    recommendedAction = "Consider rerouting or notifying recipient immediately.";
  } else if (prediction.disruptionProbability > 50) {
    alertReason = "High Disruption Probability Detected";
    recommendedAction = "Evaluate alternate corridor routes.";
  } else if (prediction.weatherConfidence < 40) {
    alertReason = "Adverse Weather Alert";
    recommendedAction = "Check vehicle weather readiness and warn driver.";
  }

  if (alertReason) {
    const alert: OperationalAlert = {
      alertId: `alert-${shipment.id}-${Date.now()}`,
      shipmentId: shipment.id,
      companyId: shipment.companyId || "system",
      reason: alertReason,
      confidence: prediction.overallOperationalConfidence,
      timestamp: new Date().toISOString(),
      recommendedAction,
    };

    const db = await getDb();
    await db.collection("operational_alerts").insertOne(alert);
    return alert;
  }

  return null;
}

export async function getOperationalAlerts(companyId: string): Promise<OperationalAlert[]> {
  const db = await getDb();
  const alerts = await db.collection("operational_alerts")
    .find({ companyId })
    .sort({ timestamp: -1 })
    .limit(50)
    .toArray();

  return alerts.map(doc => {
    const { _id, ...rest } = doc;
    return rest as unknown as OperationalAlert;
  });
}
