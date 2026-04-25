import { NextRequest, NextResponse } from "next/server";
import type { Route, AnalyzeRoutesRequest, AnalyzeRoutesResponse } from "@/lib/types";
import { getRiskLabel } from "@/lib/utils";
import { getOsrmRoutes } from "@/lib/osrm";
import { getRouteWeather } from "@/lib/weather";
import { computeRiskScore, selectRecommendedRoute } from "@/lib/risk";
import { getRouteWeatherRisk } from "@/lib/weather-service";

/**
 * POST /api/analyze-routes
 *
 * Real route intelligence pipeline:
 *   1. OSRM  → routing (distance, duration, geometry)
 *   2. OpenWeather → weather risk for the corridor
 *   3. Risk engine → composite score per route variant
 *   4. Route construction → full Route[] matching the app's type
 *
 * Falls back to static routes if external APIs are unavailable.
 * Response shape is identical to Layer 1 — no frontend changes required.
 */

// ─── Request validation ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { origin, destination, cargoType, vehicleType, urgency } =
    raw as AnalyzeRoutesRequest;

  if (!origin      || typeof origin      !== "string") return NextResponse.json({ error: "Missing required field: origin" },      { status: 400 });
  if (!destination || typeof destination !== "string") return NextResponse.json({ error: "Missing required field: destination" }, { status: 400 });
  if (!cargoType   || typeof cargoType   !== "string") return NextResponse.json({ error: "Missing required field: cargoType" },   { status: 400 });
  if (!urgency     || typeof urgency     !== "string") return NextResponse.json({ error: "Missing required field: urgency" },     { status: 400 });

  // ── Step 1: OSRM routing ───────────────────────────────────────────────────
  const osrmRoutes = await getOsrmRoutes(origin, destination);

  if (!osrmRoutes.length) {
    console.warn(`[analyze-routes] OSRM failed for ${origin}→${destination} — using static fallback`);
    const routes = buildStaticRoutes(origin, destination, cargoType, urgency);
    const response: AnalyzeRoutesResponse = {
      routes,
      analyzedAt: new Date().toISOString(),
      source: "static-fallback",
    };
    return NextResponse.json(response);
  }

  // ── Step 2: Weather ────────────────────────────────────────────────────────
  // Run corridor weather (origin+destination) and route-point weather in parallel.
  // Route-point weather samples along the geometry for more granular scoring.
  const fastestCoords = osrmRoutes[0].coordinates;

  const [corridorWeather, pointWeather] = await Promise.all([
    getRouteWeather(origin, destination),
    fastestCoords.length > 1
      ? getRouteWeatherRisk(fastestCoords)
      : Promise.resolve({ averageRisk: 20, points: [] }),
  ]);

  // Blend corridor score (70%) with point-sampled score (30%)
  const weatherScore = Math.round(
    corridorWeather.weatherScore * 0.7 + pointWeather.averageRisk * 0.3
  );

  // ── Step 3 & 4: Risk scoring + Route construction ─────────────────────────
  const scoredRoutes = osrmRoutes.map((osrmRoute) => {
    // Traffic score: OSRM has no live traffic, so we estimate from distance/duration ratio.
    // Average speed on Indian highways: ~55 km/h. Below 35 = congested.
    const avgSpeedKmh = osrmRoute.distanceKm / (osrmRoute.durationMins / 60);
    const trafficScore =
      avgSpeedKmh < 30 ? 75 :
      avgSpeedKmh < 40 ? 50 :
      avgSpeedKmh < 50 ? 30 :
      15;

    const riskResult = computeRiskScore({
      trafficScore,
      weatherScore,
      warnings:          [],
      distanceKm:        osrmRoute.distanceKm,
      etaMinutes:        osrmRoute.durationMins,
      staticEtaMinutes:  osrmRoute.staticDurationMins,
      cargoType,
      urgency,
      vehicleType:       vehicleType ?? "Container Truck",
    });

    return { osrmRoute, riskResult, trafficScore };
  });

  // Determine recommended label
  const recommendedLabel = selectRecommendedRoute(
    scoredRoutes.map(({ osrmRoute, riskResult }) => ({
      label:      osrmRoute.label,
      riskScore:  riskResult.riskScore,
      etaMinutes: osrmRoute.durationMins,
    })),
    cargoType,
    urgency
  );

  // Build final Route objects
  const routes: Route[] = scoredRoutes.map(
    ({ osrmRoute, riskResult, trafficScore }, i): Route => {
      const routeIndex = i + 1; // 1-based for naming
      const alerts = buildAlerts(
        trafficScore,
        weatherScore,
        corridorWeather.weatherAlert,
        riskResult.predictiveAlert
      );

      return {
        id:          `route-${osrmRoute.label}`,
        label:       osrmRoute.label,
        name:        `Route ${String.fromCharCode(64 + routeIndex)} — ${capitalize(osrmRoute.label)}`,
        eta:         formatMinutes(osrmRoute.durationMins),
        etaMinutes:  osrmRoute.durationMins,
        distance:    `${osrmRoute.distanceKm} km`,
        distanceKm:  osrmRoute.distanceKm,
        riskScore:   riskResult.riskScore,
        riskLevel:   riskResult.riskLevel,
        recommended: osrmRoute.label === recommendedLabel,
        summary:     buildSummary(osrmRoute.label, origin, destination, osrmRoute.durationMins, osrmRoute.distanceKm),
        riskBreakdown: riskResult.riskBreakdown,
        alerts,
      };
    }
  );

  const response: AnalyzeRoutesResponse = {
    routes,
    analyzedAt:   new Date().toISOString(),
    source:       "osrm+openweather",
    weatherScore,
  };

  return NextResponse.json(response);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildSummary(
  label: "fastest" | "balanced" | "safest",
  origin: string,
  destination: string,
  etaMins: number,
  distanceKm: number
): string {
  switch (label) {
    case "fastest":
      return `Fastest path from ${origin} to ${destination} (${formatMinutes(etaMins)}, ${distanceKm} km). Primary corridor — higher exposure to congestion.`;
    case "balanced":
      return `Balanced route from ${origin} to ${destination}. Good tradeoff between travel time and disruption risk.`;
    case "safest":
      return `Lowest-risk route from ${origin} to ${destination}. Longer path but minimal disruption probability. Recommended for sensitive cargo.`;
  }
}

function buildAlerts(
  trafficScore: number,
  weatherScore: number,
  weatherAlert: string | null,
  predictiveAlert?: string
): string[] {
  const alerts: string[] = [];

  if (weatherScore > 70 && weatherAlert) alerts.push(weatherAlert);
  else if (weatherScore > 40 && weatherAlert) alerts.push(weatherAlert);

  if (trafficScore > 70) alerts.push("Heavy congestion detected — significant delay likely");
  else if (trafficScore > 40) alerts.push("Moderate congestion on this corridor");

  if (predictiveAlert && !alerts.some((a) => a.startsWith(predictiveAlert.slice(0, 20)))) {
    alerts.push(predictiveAlert);
  }

  return alerts.slice(0, 3);
}

// ─── Static fallback ──────────────────────────────────────────────────────────

/**
 * Returns deterministic static routes when OSRM is unavailable.
 * Values are logically varied by label and cargo/urgency context.
 */
function buildStaticRoutes(
  origin: string,
  destination: string,
  cargoType: string,
  urgency: string
): Route[] {
  const isCritical  = urgency === "Critical";
  const isColdChain = cargoType === "Cold Chain Goods" || cargoType === "Pharmaceuticals";
  const cargoMod    = isColdChain ? 20 : cargoType === "Electronics" ? 10 : 0;

  const bases = [
    {
      id: "route-fastest", label: "fastest" as const, name: "Route A — Fastest",
      etaMinutes: 260, distanceKm: 347,
      riskScore: 72, traffic: 80, weather: 25, disruption: 65,
      cargoSens: Math.min(100, 55 + cargoMod),
      alerts: ["Congestion expected near primary toll corridor", "Roadwork may add 22 minutes"],
      recommended: isCritical,
    },
    {
      id: "route-balanced", label: "balanced" as const, name: "Route B — Balanced",
      etaMinutes: 305, distanceKm: 362,
      riskScore: 37, traffic: 40, weather: 20, disruption: 30,
      cargoSens: Math.min(100, 25 + cargoMod),
      alerts: ["Minor congestion possible near bypass"],
      recommended: !isCritical && !isColdChain,
    },
    {
      id: "route-safest", label: "safest" as const, name: "Route C — Safest",
      etaMinutes: 370, distanceKm: 398,
      riskScore: 14, traffic: 12, weather: 10, disruption: 8,
      cargoSens: Math.min(100, 8 + cargoMod),
      alerts: [] as string[],
      recommended: isColdChain,
    },
  ];

  const summaries: Record<string, string> = {
    fastest:  `Fastest path from ${origin} to ${destination}. Elevated risk due to congestion on the primary corridor.`,
    balanced: `Balanced route from ${origin} to ${destination}. Good tradeoff between travel time and disruption risk.`,
    safest:   `Lowest-risk route from ${origin} to ${destination}. Longer path but minimal disruption probability.`,
  };

  return bases.map((b): Route => ({
    id:           b.id,
    label:        b.label,
    name:         b.name,
    eta:          formatMinutes(b.etaMinutes),
    etaMinutes:   b.etaMinutes,
    distance:     `${b.distanceKm} km`,
    distanceKm:   b.distanceKm,
    riskScore:    b.riskScore,
    riskLevel:    getRiskLabel(b.riskScore),
    recommended:  b.recommended,
    summary:      summaries[b.label] ?? "",
    riskBreakdown: {
      traffic:          b.traffic,
      weather:          b.weather,
      disruption:       b.disruption,
      cargoSensitivity: b.cargoSens,
    },
    alerts: b.alerts,
  }));
}
