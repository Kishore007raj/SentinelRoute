/**
 * risk.ts — SentinelRoute Risk Scoring Engine.
 *
 * Computes a composite risk score (0–100) for a route given:
 *   - Traffic conditions (from Google Maps duration delta or speed intervals)
 *   - Distance (longer routes accumulate more exposure)
 *   - Cargo sensitivity (pharma/cold chain = higher sensitivity)
 *   - Urgency (critical urgency = higher tolerance for risk, lower score weight)
 *   - Weather (injected by Layer 6 — defaults to neutral 20 until then)
 *   - Disruption signals (from route warnings)
 *
 * Output:
 *   - riskScore: 0–100 integer
 *   - riskLevel: "low" | "medium" | "high" | "critical"
 *   - riskBreakdown: per-factor scores for UI display
 *   - confidencePercent: how confident the engine is in this score
 *   - predictiveAlert: human-readable alert string if risk is elevated
 */

import type { RiskLevel, RiskBreakdown } from "./types";
import { getRiskLabel } from "./utils";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface RiskInput {
  /** Traffic score 0–100 (from Google Maps speed intervals or duration delta) */
  trafficScore: number;
  /** Weather risk score 0–100 (from OpenWeather — Layer 6) */
  weatherScore: number;
  /** Disruption signals from route warnings */
  warnings: string[];
  /** Route distance in km */
  distanceKm: number;
  /** Duration with traffic in minutes */
  etaMinutes: number;
  /** Duration without traffic in minutes (static) */
  staticEtaMinutes: number;
  /** Cargo type string */
  cargoType: string;
  /** Urgency level */
  urgency: string;
  /** Vehicle type */
  vehicleType: string;
  /** Temperature sensitivity setting */
  tempSensitive?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  riskBreakdown: RiskBreakdown;
  confidencePercent: number;
  predictiveAlert?: string;
}

// ─── Factor weights ───────────────────────────────────────────────────────────
// Must sum to 1.0

const WEIGHTS = {
  traffic:          0.30,
  weather:          0.20,
  disruption:       0.20,
  cargoSensitivity: 0.15,
  distanceExposure: 0.10,
  urgencyPenalty:   0.05,
} as const;

// ─── Cargo sensitivity table ──────────────────────────────────────────────────

const CARGO_SENSITIVITY: Record<string, number> = {
  "Pharmaceuticals":   85,
  "Cold Chain Goods":  80,
  "Electronics":       60,
  "Industrial Parts":  25,
  "General Freight":   20,
};

function getCargoSensitivity(cargoType: string, tempSensitive?: string): number {
  let base = CARGO_SENSITIVITY[cargoType] ?? 30;
  // Boost if temperature sensitivity is explicitly set
  if (tempSensitive && tempSensitive !== "None") {
    base = Math.min(100, base + 15);
  }
  return base;
}

// ─── Vehicle risk modifier ────────────────────────────────────────────────────
// Some vehicles are more vulnerable to disruption

const VEHICLE_MODIFIER: Record<string, number> = {
  "Reefer Truck":    10,  // temperature-sensitive, higher risk
  "Express Van":      5,  // time-critical
  "Container Truck":  0,  // standard
  "Mini Truck":      -5,  // more agile, lower disruption risk
};

function getVehicleModifier(vehicleType: string): number {
  return VEHICLE_MODIFIER[vehicleType] ?? 0;
}

// ─── Disruption score from warnings ──────────────────────────────────────────

function computeDisruptionScore(warnings: string[]): number {
  let score = 5; // baseline — all routes have some disruption probability
  for (const w of warnings) {
    const lower = w.toLowerCase();
    if (lower.includes("closure") || lower.includes("blocked")) score += 35;
    else if (lower.includes("accident"))                         score += 28;
    else if (lower.includes("roadwork") || lower.includes("construction")) score += 20;
    else if (lower.includes("flood") || lower.includes("landslide"))       score += 30;
    else if (lower.includes("congestion") || lower.includes("traffic jam")) score += 15;
    else if (lower.includes("toll") || lower.includes("delay"))            score += 8;
    else if (w.length > 0)                                                  score += 5;
  }
  return Math.min(100, score);
}

// ─── Distance exposure score ──────────────────────────────────────────────────
// Longer routes accumulate more exposure to disruption events.
// Normalised against a 600 km reference (typical long-haul in India).

function computeDistanceExposure(distanceKm: number): number {
  const REFERENCE_KM = 600;
  return Math.min(100, Math.round((distanceKm / REFERENCE_KM) * 100));
}

// ─── Urgency penalty ──────────────────────────────────────────────────────────
// Critical urgency means the operator is willing to accept more risk.
// We reduce the urgency factor score for critical (they chose speed over safety).
// Standard/Priority urgency adds a small penalty for time pressure.

function computeUrgencyScore(urgency: string): number {
  switch (urgency) {
    case "Critical":  return 80; // high urgency = high pressure = higher risk
    case "Priority":  return 50;
    case "Standard":  return 20;
    default:          return 20;
  }
}

// ─── Confidence calculation ───────────────────────────────────────────────────
// Confidence is higher when:
// - We have real traffic data (not estimated)
// - Weather data is available (Layer 6)
// - Distance is within known corridors

function computeConfidence(
  hasRealTraffic: boolean,
  hasWeatherData: boolean,
  distanceKm: number
): number {
  let confidence = 60; // base confidence

  if (hasRealTraffic)  confidence += 20;
  if (hasWeatherData)  confidence += 15;
  if (distanceKm < 400) confidence += 5; // shorter routes = more predictable

  return Math.min(99, confidence);
}

// ─── Predictive alert generation ─────────────────────────────────────────────

function generatePredictiveAlert(
  riskScore: number,
  trafficScore: number,
  weatherScore: number,
  disruption: number,
  cargoType: string
): string | undefined {
  if (riskScore < 30) return undefined;

  // Most severe factor drives the alert
  const factors = [
    { score: trafficScore, msg: "Heavy congestion expected — ETA delay likely" },
    { score: weatherScore, msg: "Adverse weather conditions on this corridor" },
    { score: disruption,   msg: "Route disruption signals detected" },
  ].sort((a, b) => b.score - a.score);

  const top = factors[0];
  if (!top || top.score < 35) return undefined;

  // Cargo-specific suffix
  const cargoSuffix =
    cargoType === "Pharmaceuticals" || cargoType === "Cold Chain Goods"
      ? " — cold chain integrity at risk"
      : cargoType === "Electronics"
        ? " — heat exposure risk elevated"
        : "";

  return top.msg + cargoSuffix;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Computes a composite risk score for a route.
 *
 * @param input - All factors needed for scoring
 * @param weatherScore - Injected by Layer 6 (OpenWeather). Pass 20 as neutral default.
 * @returns RiskResult with score, level, breakdown, confidence, and alert
 */
export function computeRiskScore(input: RiskInput): RiskResult {
  const {
    trafficScore,
    weatherScore,
    warnings,
    distanceKm,
    cargoType,
    urgency,
    vehicleType,
    tempSensitive,
  } = input;

  // ── Compute individual factor scores ──────────────────────────────────────
  const cargoSensitivity = getCargoSensitivity(cargoType, tempSensitive);
  const disruption       = computeDisruptionScore(warnings);
  const distanceExposure = computeDistanceExposure(distanceKm);
  const urgencyScore     = computeUrgencyScore(urgency);
  const vehicleMod       = getVehicleModifier(vehicleType);

  // ── Weighted composite ────────────────────────────────────────────────────
  const rawScore =
    trafficScore    * WEIGHTS.traffic          +
    weatherScore    * WEIGHTS.weather          +
    disruption      * WEIGHTS.disruption       +
    cargoSensitivity * WEIGHTS.cargoSensitivity +
    distanceExposure * WEIGHTS.distanceExposure +
    urgencyScore    * WEIGHTS.urgencyPenalty;

  // Apply vehicle modifier (additive, not weighted)
  const adjustedScore = rawScore + vehicleMod;
  const riskScore = Math.min(100, Math.max(1, Math.round(adjustedScore)));
  const riskLevel: RiskLevel = getRiskLabel(riskScore);

  // ── Breakdown (for UI display) ────────────────────────────────────────────
  const riskBreakdown: RiskBreakdown = {
    traffic:          Math.round(trafficScore),
    weather:          Math.round(weatherScore),
    disruption:       Math.round(disruption),
    cargoSensitivity: Math.round(cargoSensitivity),
  };

  // ── Confidence ────────────────────────────────────────────────────────────
  const hasRealTraffic = input.staticEtaMinutes > 0 && input.etaMinutes !== input.staticEtaMinutes;
  const hasWeatherData = weatherScore !== 20; // 20 = neutral placeholder
  const confidencePercent = computeConfidence(hasRealTraffic, hasWeatherData, distanceKm);

  // ── Predictive alert ──────────────────────────────────────────────────────
  const predictiveAlert = generatePredictiveAlert(
    riskScore,
    trafficScore,
    weatherScore,
    disruption,
    cargoType
  );

  return {
    riskScore,
    riskLevel,
    riskBreakdown,
    confidencePercent,
    predictiveAlert,
  };
}

// ─── Recommendation logic ─────────────────────────────────────────────────────

/**
 * Given 3 scored routes, determines which one to recommend.
 *
 * Rules (in priority order):
 * 1. Critical urgency → recommend fastest
 * 2. Cold chain / pharma → recommend safest
 * 3. Otherwise → recommend the route with best risk-to-ETA ratio
 */
export function selectRecommendedRoute(
  routes: Array<{ label: string; riskScore: number; etaMinutes: number }>,
  cargoType: string,
  urgency: string
): string {
  if (urgency === "Critical") return "fastest";

  const isColdChain =
    cargoType === "Cold Chain Goods" || cargoType === "Pharmaceuticals";
  if (isColdChain) return "safest";

  // Best risk-to-ETA ratio: minimise (riskScore / 100) + (etaMinutes / maxEta * 0.3)
  const maxEta = Math.max(...routes.map((r) => r.etaMinutes));
  let best = routes[0];
  let bestScore = Infinity;

  for (const route of routes) {
    const composite =
      (route.riskScore / 100) +
      (route.etaMinutes / maxEta) * 0.3;
    if (composite < bestScore) {
      bestScore = composite;
      best = route;
    }
  }

  return best.label;
}
