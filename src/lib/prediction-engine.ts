import { getDb } from "./mongodb";
import { RoutePrediction, Shipment } from "./types";
import { getActiveIncidents } from "./intelligence-service";

/**
 * Calculates deterministic probabilities and confidence for a shipment based on live data.
 * No AI hallucination — strict formulas.
 */
export async function calculateRoutePrediction(shipment: Shipment): Promise<RoutePrediction> {
  const incidents = await getActiveIncidents(shipment.companyId);
  
  // Filter incidents affecting the shipment (simplified mock logic: if it's high severity, it affects it)
  // In a real scenario, this would use geometry matching
  let trafficStability = 90;
  let weatherConfidence = 85;
  let incidentDensity = 10;
  let delayProbability = 5;
  let disruptionProbability = 2;
  const contributingFactors: string[] = ["Historical baseline route reliability"];
  const sourceApis: string[] = ["SentinelRoute Risk Baseline"];

  // Analyze incidents
  const criticalIncidents = incidents.filter(i => i.severity === "critical");
  const highIncidents = incidents.filter(i => i.severity === "high");

  if (criticalIncidents.length > 0) {
    delayProbability += 40;
    disruptionProbability += 20;
    trafficStability -= 30;
    incidentDensity += 40;
    contributingFactors.push("Critical incidents detected near route");
    sourceApis.push("NHAI Feed");
  } else if (highIncidents.length > 0) {
    delayProbability += 20;
    disruptionProbability += 5;
    trafficStability -= 15;
    incidentDensity += 20;
    contributingFactors.push("High severity incidents detected near route");
    sourceApis.push("NHAI Feed");
  }

  // Weather assessment
  const weatherIncidents = incidents.filter(i => i.category === "Weather");
  if (weatherIncidents.length > 0) {
    weatherConfidence -= 30;
    delayProbability += 15;
    contributingFactors.push("Adverse weather conditions reported");
    sourceApis.push("OpenWeather API");
  }

  // Cap values
  delayProbability = Math.min(100, delayProbability);
  disruptionProbability = Math.min(100, disruptionProbability);
  trafficStability = Math.max(0, trafficStability);
  weatherConfidence = Math.max(0, weatherConfidence);
  incidentDensity = Math.min(100, incidentDensity);

  const etaConfidence = 100 - delayProbability;
  const corridorVolatility = Math.min(100, (100 - trafficStability) + incidentDensity);
  const overallOperationalConfidence = Math.round((etaConfidence + trafficStability + weatherConfidence) / 3);

  const predictionId = `pred-${shipment.id}-${Date.now()}`;

  const prediction: RoutePrediction = {
    predictionId,
    shipmentId: shipment.id,
    companyId: shipment.companyId || "system",
    timestamp: new Date().toISOString(),
    delayProbability,
    disruptionProbability,
    etaConfidence,
    corridorVolatility,
    weatherConfidence,
    incidentDensity,
    trafficStability,
    historicalCorridorReliability: 88, // Static for now, could be dynamic
    riskTrend: overallOperationalConfidence > 70 ? "stable" : "degrading",
    expectedDelayMinutes: delayProbability > 30 ? Math.round(delayProbability * 0.5) : 0,
    recommendedRouteConfidence: etaConfidence > 50 ? etaConfidence : 50,
    overallOperationalConfidence,
    reason: overallOperationalConfidence > 80 ? "Optimal conditions" : overallOperationalConfidence > 50 ? "Minor disruptions detected" : "High risk of delay or disruption",
    contributingFactors,
    sourceApis,
  };

  const db = await getDb();
  await db.collection("route_predictions").insertOne(prediction);

  return prediction;
}

export async function getShipmentPredictions(shipmentId: string): Promise<RoutePrediction[]> {
  const db = await getDb();
  const predictions = await db.collection("route_predictions")
    .find({ shipmentId })
    .sort({ timestamp: -1 })
    .toArray();

  return predictions.map(doc => {
    const { _id, ...rest } = doc;
    return rest as unknown as RoutePrediction;
  });
}
