/**
 * risk.ts — Risk scoring engine for SentinelRoute.
 *
 * Two public APIs:
 *   computeRiskScore(params) → { riskScore, riskLevel, riskBreakdown, predictiveAlert }
 *   selectRecommendedRoute(candidates, cargoType, urgency) → RouteLabel
 *
 * Legacy export kept for backward compatibility:
 *   computeRisk(distanceKm, durationHours, weatherRisk, cargoType, urgency)
 *   getRiskLabel(score)
 */

import type { RiskLevel, RouteLabel } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskBreakdown {
  traffic:          number;
  weather:          number;
  disruption:       number;
  cargoSensitivity: number;
}

export interface RiskResult {
  riskScore:     number;
  riskLevel:     RiskLevel;
  riskBreakdown: RiskBreakdown;
  predictiveAlert?: string;
}

export interface RiskParams {
  /** Traffic congestion score 0–100 (from OSRM duration vs static, or Maps intervals) */
  trafficScore:      number;
  /** Weather severity score 0–100 (from OpenWeather) */
  weatherScore:      number;
  /** Route warnings from the routing API */
  warnings:          string[];
  distanceKm:        number;
  etaMinutes:        number;
  /** Static (no-traffic) ETA in minutes — used to compute delay ratio */
  staticEtaMinutes:  number;
  cargoType:         string;
  urgency:           string;
  vehicleType?:      string;
  tempSensitive?:    string;
}

// ─── Cargo sensitivity table ──────────────────────────────────────────────────

const CARGO_SENSITIVITY: Record<string, number> = {
  "Pharmaceuticals":  85,
  "Cold Chain Goods": 80,
  "Electronics":      55,
  "Industrial Parts": 20,
  "General Freight":  10,
};

function cargoSensitivityScore(cargoType: string, tempSensitive?: string): number {
  const base = CARGO_SENSITIVITY[cargoType] ?? 25;
  // Boost if explicit temp sensitivity is set
  if (tempSensitive && tempSensitive !== "None") {
    return Math.min(100, base + 10);
  }
  return base;
}

// ─── Disruption score ─────────────────────────────────────────────────────────

function disruptionScore(
  distanceKm: number,
  etaMinutes: number,
  staticEtaMinutes: number,
  warnings: string[]
): number {
  // Base: distance-driven exposure (longer route = more exposure)
  const distanceBase = Math.min(30, distanceKm / 15);

  // Delay ratio: how much longer than static ETA
  const delayRatio = staticEtaMinutes > 0
    ? (etaMinutes - staticEtaMinutes) / staticEtaMinutes
    : 0;
  const delayScore = Math.min(40, delayRatio * 100);

  // Warning penalty
  const warningPenalty = Math.min(20, warnings.length * 8);

  return Math.round(distanceBase + delayScore + warningPenalty);
}

// ─── Urgency multiplier ───────────────────────────────────────────────────────

function urgencyMultiplier(urgency: string): number {
  if (urgency === "Critical") return 1.45;
  if (urgency === "Priority") return 1.20;
  return 1.0;
}

// ─── Predictive alert ─────────────────────────────────────────────────────────

function buildPredictiveAlert(
  trafficScore: number,
  weatherScore: number,
  cargoType: string,
  warnings: string[]
): string | undefined {
  if (weatherScore > 70) return "Severe weather on corridor — consider delay";
  if (trafficScore > 75) return "Heavy congestion detected — significant delay likely";
  if (warnings.length > 0) return warnings[0];
  if (cargoType === "Pharmaceuticals" || cargoType === "Cold Chain Goods") {
    if (trafficScore > 40) return "Temperature-sensitive cargo — monitor delay risk";
  }
  return undefined;
}

// ─── Main scoring function ────────────────────────────────────────────────────

/**
 * Computes a composite risk score 0–100 from routing, weather, and cargo data.
 *
 * Weights:
 *   Traffic:          30%
 *   Weather:          30%
 *   Disruption:       25%
 *   Cargo sensitivity: 15%
 *
 * Then multiplied by urgency factor.
 */
export function computeRiskScore(params: RiskParams): RiskResult {
  const {
    trafficScore,
    weatherScore,
    warnings,
    distanceKm,
    etaMinutes,
    staticEtaMinutes,
    cargoType,
    urgency,
    tempSensitive,
  } = params;

  const cargoScore   = cargoSensitivityScore(cargoType, tempSensitive);
  const disruption   = disruptionScore(distanceKm, etaMinutes, staticEtaMinutes, warnings);
  const multiplier   = urgencyMultiplier(urgency);

  // Weighted composite (before urgency)
  const raw =
    trafficScore * 0.30 +
    weatherScore * 0.30 +
    disruption   * 0.25 +
    cargoScore   * 0.15;

  const riskScore = Math.min(100, Math.max(0, Math.round(raw * multiplier)));

  const riskBreakdown: RiskBreakdown = {
    traffic:          Math.round(trafficScore),
    weather:          Math.round(weatherScore),
    disruption:       Math.round(disruption),
    cargoSensitivity: Math.round(cargoScore),
  };

  return {
    riskScore,
    riskLevel:      getRiskLabel(riskScore),
    riskBreakdown,
    predictiveAlert: buildPredictiveAlert(trafficScore, weatherScore, cargoType, warnings),
  };
}

// ─── Route recommendation ─────────────────────────────────────────────────────

/**
 * Selects the recommended route label given a set of scored candidates.
 *
 * Logic:
 *   - Critical urgency → always fastest
 *   - Cold-chain / Pharma → always safest
 *   - Otherwise → balanced (or lowest risk if balanced is much worse)
 */
export function selectRecommendedRoute(
  candidates: Array<{ label: RouteLabel; riskScore: number; etaMinutes: number }>,
  cargoType: string,
  urgency: string
): RouteLabel {
  if (urgency === "Critical") return "fastest";

  const isSensitive =
    cargoType === "Pharmaceuticals" || cargoType === "Cold Chain Goods";
  if (isSensitive) return "safest";

  // Default: balanced — but if balanced risk is >20 points worse than safest, use safest
  const balanced = candidates.find((c) => c.label === "balanced");
  const safest   = candidates.find((c) => c.label === "safest");

  if (balanced && safest && balanced.riskScore - safest.riskScore > 20) {
    return "safest";
  }

  return "balanced";
}

// ─── Legacy exports (backward compatibility) ──────────────────────────────────

/** @deprecated Use computeRiskScore instead */
export function computeRisk(
  distanceKm: number,
  durationHours: number,
  weatherRisk: number,
  cargoType: string,
  urgency: string
): { score: number; level: RiskLevel } {
  const result = computeRiskScore({
    trafficScore:     weatherRisk * 0.5,
    weatherScore:     weatherRisk,
    warnings:         [],
    distanceKm,
    etaMinutes:       Math.round(durationHours * 60),
    staticEtaMinutes: Math.round(durationHours * 60),
    cargoType,
    urgency,
  });
  return { score: result.riskScore, level: result.riskLevel };
}

export function getRiskLabel(score: number): RiskLevel {
  if (score > 75) return "critical";
  if (score > 50) return "high";
  if (score > 25) return "medium";
  return "low";
}
