import { NextRequest, NextResponse } from "next/server";
import type { Route, AnalyzeRoutesRequest, AnalyzeRoutesResponse } from "@/lib/types";
import { fetchGoogleRoutes } from "@/lib/google-maps";
import { buildRoutesFromMapsResponse } from "@/lib/route-builder";
import { computeRiskScore, selectRecommendedRoute } from "@/lib/risk";
import { getRouteWeather } from "@/lib/weather";
import { getRiskLabel } from "@/lib/utils";

/**
 * POST /api/analyze-routes
 *
 * Layer 4+5+6: Google Maps Routes API + Risk Engine + OpenWeather.
 *
 * Pipeline:
 *   1. Fetch real routes from Google Maps (or fall back to static)
 *   2. Fetch live weather for origin + destination corridor (parallel)
 *   3. Run full risk engine with real traffic + weather scores
 *
 * Falls back gracefully at each step — app always returns 3 routes.
 */
export async function POST(req: NextRequest) {
  let body: AnalyzeRoutesRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { origin, destination, cargoType, vehicleType, urgency } = body;

  if (!origin || !destination || !cargoType || !urgency) {
    return NextResponse.json(
      { error: "Missing required fields: origin, destination, cargoType, urgency" },
      { status: 400 }
    );
  }

  // ── Fetch routes + weather in parallel ───────────────────────────────────
  const [mapsRoutes, weatherResult] = await Promise.all([
    fetchGoogleRoutes(origin, destination),
    getRouteWeather(origin, destination),
  ]);

  const { weatherScore, weatherAlert } = weatherResult;

  let routes: Route[];
  let source: "google-maps" | "static";

  if (mapsRoutes && mapsRoutes.length > 0) {
    routes = buildRoutesFromMapsResponse(
      mapsRoutes,
      origin,
      destination,
      cargoType,
      urgency,
      vehicleType,
      undefined,
      weatherScore
    );
    source = "google-maps";
    console.log(
      `[analyze-routes] Google Maps + risk engine + weather(${weatherScore}): ` +
      `${routes.length} routes for ${origin} → ${destination}`
    );
  } else {
    routes = buildStaticRoutesWithRiskEngine(
      origin,
      destination,
      cargoType,
      vehicleType ?? "Container Truck",
      urgency,
      weatherScore
    );
    source = "static";
    console.log(
      `[analyze-routes] Static + risk engine + weather(${weatherScore}) ` +
      `fallback for ${origin} → ${destination}`
    );
  }

  // ── Inject weather alert into the highest-risk route ─────────────────────
  if (weatherAlert) {
    const highestRisk = [...routes].sort((a, b) => b.riskScore - a.riskScore)[0];
    if (highestRisk) {
      const idx = routes.findIndex((r) => r.id === highestRisk.id);
      if (idx !== -1 && !routes[idx].alerts.includes(weatherAlert)) {
        routes[idx] = {
          ...routes[idx],
          alerts: [weatherAlert, ...routes[idx].alerts].slice(0, 3),
        };
      }
    }
  }

  const response: AnalyzeRoutesResponse & { source: string; weatherScore: number } = {
    routes,
    analyzedAt: new Date().toISOString(),
    source,
    weatherScore,
  };

  return NextResponse.json(response);
}

// ─── Static fallback with full risk engine ────────────────────────────────────
// Uses fixed distance/ETA/traffic baselines but runs them through
// computeRiskScore so cargo type and urgency affect the scores.

interface StaticRouteBase {
  id: string;
  label: "fastest" | "balanced" | "safest";
  name: string;
  etaMinutes: number;
  distanceKm: number;
  trafficScore: number;
  staticEtaMinutes: number;
  warnings: string[];
}

const STATIC_BASES: StaticRouteBase[] = [
  {
    id: "route-a", label: "fastest", name: "Route A — Fastest",
    etaMinutes: 260, staticEtaMinutes: 210, distanceKm: 347,
    trafficScore: 78,
    warnings: [
      "Congestion expected near primary toll corridor",
      "Roadwork may add 22 minutes to arrival",
    ],
  },
  {
    id: "route-b", label: "balanced", name: "Route B — Balanced",
    etaMinutes: 305, staticEtaMinutes: 285, distanceKm: 362,
    trafficScore: 38,
    warnings: ["Minor congestion possible near bypass"],
  },
  {
    id: "route-c", label: "safest", name: "Route C — Safest",
    etaMinutes: 370, staticEtaMinutes: 360, distanceKm: 398,
    trafficScore: 12,
    warnings: [],
  },
];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function buildStaticRoutesWithRiskEngine(
  origin: string,
  destination: string,
  cargoType: string,
  vehicleType: string,
  urgency: string,
  weatherScore: number
): Route[] {
  // Score all routes
  const scored = STATIC_BASES.map((base) => {
    const riskResult = computeRiskScore({
      trafficScore:     base.trafficScore,
      weatherScore,
      warnings:         base.warnings,
      distanceKm:       base.distanceKm,
      etaMinutes:       base.etaMinutes,
      staticEtaMinutes: base.staticEtaMinutes,
      cargoType,
      urgency,
      vehicleType,
    });
    return { base, riskResult };
  });

  // Determine recommendation
  const recommendedLabel = selectRecommendedRoute(
    scored.map(({ base, riskResult }) => ({
      label:      base.label,
      riskScore:  riskResult.riskScore,
      etaMinutes: base.etaMinutes,
    })),
    cargoType,
    urgency
  );

  const trafficDesc = (score: number) =>
    score > 60 ? "heavy traffic conditions" :
    score > 35 ? "moderate traffic" : "light traffic";

  return scored.map(({ base, riskResult }): Route => {
    const alerts: string[] = [...base.warnings];
    if (riskResult.predictiveAlert && !alerts.includes(riskResult.predictiveAlert)) {
      alerts.push(riskResult.predictiveAlert);
    }

    const summaryMap: Record<string, string> = {
      fastest: `Fastest path from ${origin} to ${destination} (${formatMinutes(base.etaMinutes)}, ${base.distanceKm} km). ${trafficDesc(base.trafficScore).charAt(0).toUpperCase() + trafficDesc(base.trafficScore).slice(1)} detected.`,
      balanced: `Balanced route from ${origin} to ${destination}. Good tradeoff between travel time and disruption risk with ${trafficDesc(base.trafficScore)}.`,
      safest: `Lowest-risk route from ${origin} to ${destination}. Longer path but minimal disruption probability. Recommended for sensitive cargo.`,
    };

    return {
      id:          base.id,
      label:       base.label,
      name:        base.name,
      eta:         formatMinutes(base.etaMinutes),
      etaMinutes:  base.etaMinutes,
      distance:    `${base.distanceKm} km`,
      distanceKm:  base.distanceKm,
      riskScore:   riskResult.riskScore,
      riskLevel:   getRiskLabel(riskResult.riskScore),
      recommended: base.label === recommendedLabel,
      summary:     summaryMap[base.label] ?? "",
      riskBreakdown: riskResult.riskBreakdown,
      alerts:      alerts.slice(0, 3),
    };
  });
}
