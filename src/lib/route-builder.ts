/**
 * route-builder.ts — Converts raw Google Maps Routes API responses
 * into the app's Route[] shape, using the full risk engine.
 *
 * Takes up to 3 MapsRoute objects and assigns them labels:
 *   [0] = fastest  (shortest duration)
 *   [1] = balanced (middle option, or synthesized)
 *   [2] = safest   (longest duration / lowest traffic)
 */

import type { Route, RouteLabel } from "./types";
import {
  type MapsRoute,
  parseDurationToMinutes,
  formatMinutes,
  estimateTrafficScore,
} from "./google-maps";
import { computeRiskScore, selectRecommendedRoute } from "./risk";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE_LABELS: RouteLabel[] = ["fastest", "balanced", "safest"];
const ROUTE_NAMES  = ["Route A — Fastest", "Route B — Balanced", "Route C — Safest"];
const ROUTE_IDS    = ["route-a", "route-b", "route-c"];

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(
  label: RouteLabel,
  origin: string,
  destination: string,
  etaMinutes: number,
  distanceKm: number,
  trafficScore: number
): string {
  const trafficDesc =
    trafficScore > 60 ? "heavy traffic conditions" :
    trafficScore > 35 ? "moderate traffic" :
    "light traffic";

  switch (label) {
    case "fastest":
      return `Fastest path from ${origin} to ${destination} (${formatMinutes(etaMinutes)}, ${distanceKm} km). ${trafficDesc.charAt(0).toUpperCase() + trafficDesc.slice(1)} detected along this corridor.`;
    case "balanced":
      return `Balanced route from ${origin} to ${destination}. Good tradeoff between travel time and disruption risk with ${trafficDesc}.`;
    case "safest":
      return `Lowest-risk route from ${origin} to ${destination}. Longer path but minimal disruption probability. Recommended for sensitive cargo.`;
  }
}

// ─── Alert builder ────────────────────────────────────────────────────────────

function buildAlerts(
  route: MapsRoute,
  trafficScore: number,
  predictiveAlert?: string
): string[] {
  const alerts: string[] = [];

  if (trafficScore > 70) alerts.push("Heavy congestion detected — significant delay likely");
  else if (trafficScore > 40) alerts.push("Moderate congestion on this corridor");

  for (const w of route.warnings ?? []) {
    if (w.length > 0 && !alerts.includes(w)) alerts.push(w);
  }

  // Add predictive alert if not already covered
  if (predictiveAlert && !alerts.some((a) => a.includes(predictiveAlert.slice(0, 20)))) {
    alerts.push(predictiveAlert);
  }

  return alerts.slice(0, 3);
}

// ─── Main converter ───────────────────────────────────────────────────────────

/**
 * Converts up to 3 MapsRoute objects into the app's Route[] shape.
 * Uses the full risk engine (computeRiskScore) for scoring.
 *
 * @param weatherScore - Injected by Layer 6. Pass 20 as neutral default.
 */
export function buildRoutesFromMapsResponse(
  mapsRoutes: MapsRoute[],
  origin: string,
  destination: string,
  cargoType: string,
  urgency: string,
  vehicleType: string = "Container Truck",
  tempSensitive?: string,
  weatherScore: number = 20
): Route[] {
  // Sort by duration ascending: [fastest, ..., slowest]
  const sorted = [...mapsRoutes].sort((a, b) =>
    parseDurationToMinutes(a.duration) - parseDurationToMinutes(b.duration)
  );

  // Ensure exactly 3 slots
  const slots: MapsRoute[] = [
    sorted[0],
    sorted[1] ?? synthesizeRoute(sorted[0], 1.18, 1.05),
    sorted[2] ?? synthesizeRoute(sorted[0], 1.42, 1.15),
  ];

  // ── Score all routes ───────────────────────────────────────────────────────
  const scored = slots.map((mapsRoute, i) => {
    const label          = ROUTE_LABELS[i];
    const etaMins        = parseDurationToMinutes(mapsRoute.duration);
    const staticEtaMins  = parseDurationToMinutes(mapsRoute.staticDuration);
    const distKm         = Math.round(mapsRoute.distanceMeters / 1000);
    const trafficScore   = estimateTrafficScore(mapsRoute);

    const riskResult = computeRiskScore({
      trafficScore,
      weatherScore,
      warnings:         mapsRoute.warnings ?? [],
      distanceKm:       distKm,
      etaMinutes:       etaMins,
      staticEtaMinutes: staticEtaMins,
      cargoType,
      urgency,
      vehicleType,
      tempSensitive,
    });

    return {
      label,
      etaMins,
      distKm,
      trafficScore,
      mapsRoute,
      riskResult,
      index: i,
    };
  });

  // ── Determine recommendation ───────────────────────────────────────────────
  const recommendedLabel = selectRecommendedRoute(
    scored.map((s) => ({
      label:      s.label,
      riskScore:  s.riskResult.riskScore,
      etaMinutes: s.etaMins,
    })),
    cargoType,
    urgency
  );

  // ── Build final Route objects ──────────────────────────────────────────────
  return scored.map(({ label, etaMins, distKm, trafficScore, mapsRoute, riskResult, index }): Route => ({
    id:          ROUTE_IDS[index],
    label,
    name:        ROUTE_NAMES[index],
    eta:         formatMinutes(etaMins),
    etaMinutes:  etaMins,
    distance:    `${distKm} km`,
    distanceKm:  distKm,
    riskScore:   riskResult.riskScore,
    riskLevel:   riskResult.riskLevel,
    recommended: label === recommendedLabel,
    summary:     buildSummary(label, origin, destination, etaMins, distKm, trafficScore),
    riskBreakdown: riskResult.riskBreakdown,
    alerts:      buildAlerts(mapsRoute, trafficScore, riskResult.predictiveAlert),
    polyline:    mapsRoute.polyline?.encodedPolyline,
  }));
}

// ─── Synthesize a route variant ───────────────────────────────────────────────

function synthesizeRoute(
  base: MapsRoute,
  durationMultiplier: number,
  distanceMultiplier: number
): MapsRoute {
  const baseMins = parseDurationToMinutes(base.duration);
  const newSecs  = Math.round(baseMins * durationMultiplier * 60);
  return {
    ...base,
    duration:       `${newSecs}s`,
    staticDuration: `${newSecs}s`,
    distanceMeters: Math.round(base.distanceMeters * distanceMultiplier),
    warnings:       [],
  };
}
