import { RiskLevel } from "./types";

export function computeRisk(
  distanceKm: number,
  durationHours: number,
  weatherRisk: number,
  cargoType: string,
  urgency: string
): { score: number; level: RiskLevel } {
  // Base risk from distance (1 point per 100km)
  const distanceRisk = Math.min(20, distanceKm / 10);

  // Duration risk (higher duration relative to distance = traffic/delays)
  // Average speed in India is ~40-50 km/h. If speed < 30km/h, higher risk.
  const averageSpeed = distanceKm / durationHours;
  const trafficRisk = averageSpeed < 30 ? 30 : averageSpeed < 45 ? 15 : 5;

  // Cargo sensitivity
  const cargoWeights: Record<string, number> = {
    "Pharmaceuticals": 40,
    "Cold Chain Goods": 35,
    "Electronics": 25,
    "Industrial Parts": 10,
    "General Freight": 5,
  };
  const cargoRisk = cargoWeights[cargoType] || 15;

  // Urgency multiplier
  const urgencyMultiplier = urgency === "Critical" ? 1.5 : urgency === "Priority" ? 1.2 : 1.0;

  // Composite Score
  // Weights: Weather (30%), Traffic (25%), Cargo (25%), Distance (20%)
  const rawScore = (
    (weatherRisk * 0.35) +
    (trafficRisk * 0.25) +
    (cargoRisk * 0.20) +
    (distanceRisk * 0.20)
  ) * urgencyMultiplier;

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let level: RiskLevel = "low";
  if (score > 75) level = "critical";
  else if (score > 50) level = "high";
  else if (score > 25) level = "medium";

  return { score, level };
}

export function getRiskLabel(score: number): RiskLevel {
  if (score > 75) return "critical";
  if (score > 50) return "high";
  if (score > 25) return "medium";
  return "low";
}
