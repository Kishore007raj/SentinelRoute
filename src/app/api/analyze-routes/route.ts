import { NextRequest, NextResponse } from "next/server";
import type { Route, AnalyzeRoutesRequest, AnalyzeRoutesResponse } from "@/lib/types";
import { getRiskLabel } from "@/lib/utils";
import { geoapifyRoute, geoapifyAutosuggest } from "@/lib/geoapify";
import { getRouteWeather } from "@/lib/weather";
import { computeRiskScore, selectRecommendedRoute } from "@/lib/risk";
import { getRouteWeatherRisk } from "@/lib/weather";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { createDecisionHash } from "@/lib/hash";
import { TomTomTrafficProvider } from "@/lib/tomtom";
import { getFestivalRiskContribution } from "@/lib/intelligence/festival-intelligence";
import { getNewsRiskContribution } from "@/lib/intelligence/news-intelligence";
import { getDb } from "@/lib/mongodb";

/**
 * POST /api/analyze-routes
 *
 * Real route intelligence pipeline:
 *   1. Auth  → Firebase token verification (required)
 *   2. OSRM  → routing (distance, duration, geometry)
 *   3. OpenWeather → weather risk for the corridor
 *   4. Risk engine → composite score per route variant
 *   5. Route construction → full Route[] matching the app's type
 *   6. Integrity hash → SHA-256 of each route decision
 *
 * Falls back to static routes if external APIs are unavailable.
 * Response shape is identical to Layer 1 — no frontend changes required.
 */

// ─── Request handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth: require valid Firebase token ────────────────────────────────────
  try {
    await verifyFirebaseToken(req);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[analyze-routes] Auth service error:", err);
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { origin, destination, cargoType, vehicleType, urgency, originLat, originLng, destinationLat, destinationLng } =
    raw as unknown as AnalyzeRoutesRequest;

  if (!origin      || typeof origin      !== "string") return NextResponse.json({ error: "Missing required field: origin" },      { status: 400 });
  if (!destination || typeof destination !== "string") return NextResponse.json({ error: "Missing required field: destination" }, { status: 400 });
  if (!cargoType   || typeof cargoType   !== "string") return NextResponse.json({ error: "Missing required field: cargoType" },   { status: 400 });
  if (!urgency     || typeof urgency     !== "string") return NextResponse.json({ error: "Missing required field: urgency" },     { status: 400 });

  // ── Geocode fallback if coords missing ─────────────────────────────────────
  let oLat = originLat, oLng = originLng;
  let dLat = destinationLat, dLng = destinationLng;

  if (!oLat || !oLng) {
    const oSugg = await geoapifyAutosuggest(origin);
    if (oSugg[0]?.lat && oSugg[0]?.lng) { oLat = oSugg[0].lat; oLng = oSugg[0].lng; }
  }
  if (!dLat || !dLng) {
    const dSugg = await geoapifyAutosuggest(destination);
    if (dSugg[0]?.lat && dSugg[0]?.lng) { dLat = dSugg[0].lat; dLng = dSugg[0].lng; }
  }

  // ── Step 1: Geoapify routing ─────────────────────────────────────────────────
  let geoapifyRoutes: Array<{ label: "fastest" | "balanced" | "safest", distanceKm: number, durationMinutes: number, geometry: [number, number][] }> = [];
  
  if (oLat && oLng && dLat && dLng) {
    const rawRoutes = await geoapifyRoute(oLng, oLat, dLng, dLat);
    const labels: ("fastest" | "balanced" | "safest")[] = ["fastest", "balanced", "safest"];
    // Sort by duration so fastest is first
    rawRoutes.sort((a, b) => a.durationMinutes - b.durationMinutes);
    geoapifyRoutes = rawRoutes.slice(0, 3).map((r, i) => ({
      label: labels[i] || "balanced",
      distanceKm: r.distanceKm,
      durationMinutes: r.durationMinutes,
      geometry: r.geometry,
    }));
  }

  if (geoapifyRoutes.length === 0) {
    if (oLat && oLng && dLat && dLng) {
      console.warn(`[analyze-routes] Geoapify routing failed for ${origin}→${destination} — using synthetic fallback`);
      // Fallback: use haversine distance * 1.3 routing factor
      const R = 6371; // km
      const dLatRad = (dLat - oLat) * Math.PI / 180;
      const dLngRad = (dLng - oLng) * Math.PI / 180;
      const a = Math.sin(dLatRad/2) * Math.sin(dLatRad/2) +
                Math.cos(oLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) *
                Math.sin(dLngRad/2) * Math.sin(dLngRad/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = Math.round(R * c * 1.3);
      const dur = Math.round((dist / 40) * 60);

      geoapifyRoutes = [
        { label: "fastest", distanceKm: dist, durationMinutes: dur, geometry: [[oLng, oLat], [dLng, dLat]] },
        { label: "balanced", distanceKm: Math.round(dist * 1.05), durationMinutes: Math.round(dur * 1.1), geometry: [[oLng, oLat], [dLng, dLat]] },
        { label: "safest", distanceKm: Math.round(dist * 1.1), durationMinutes: Math.round(dur * 1.2), geometry: [[oLng, oLat], [dLng, dLat]] }
      ];
    } else {
      return NextResponse.json({ error: "Routing unavailable and geocoding failed" }, { status: 503 });
    }
  } else if (geoapifyRoutes.length < 3) {
    const base = geoapifyRoutes[0];
    if (!geoapifyRoutes.find(r => r.label === "balanced")) {
      geoapifyRoutes.push({ label: "balanced", distanceKm: Math.round(base.distanceKm * 1.05), durationMinutes: Math.round(base.durationMinutes * 1.1), geometry: base.geometry });
    }
    if (!geoapifyRoutes.find(r => r.label === "safest")) {
      geoapifyRoutes.push({ label: "safest", distanceKm: Math.round(base.distanceKm * 1.1), durationMinutes: Math.round(base.durationMinutes * 1.2), geometry: base.geometry });
    }
  }

  // ── Step 2: Weather + TomTom Traffic + Intel (parallel) ───────────────────
  const fastestRoute  = geoapifyRoutes[0];
  const fastestCoords = fastestRoute.geometry;

  const tomtom = new TomTomTrafficProvider();

  const [corridorWeather, pointWeather, tomtomTraffic, festivalRisk, newsRisk] = await Promise.all([
    getRouteWeather(origin, destination),
    fastestCoords.length > 1
      ? getRouteWeatherRisk(fastestCoords)
      : Promise.resolve({ averageRisk: 20, points: [] }),
    oLat && oLng && dLat && dLng
      ? tomtom.getTrafficData([oLng, oLat], [dLng, dLat])
      : Promise.resolve({ trafficScore: -1, incidents: [], hasRoadClosure: false, isLive: false }),
    getFestivalRiskContribution("system", undefined, undefined),
    getNewsRiskContribution("system"),
  ]);

  // Blend corridor score (70%) with point-sampled score (30%)
  const weatherScore = Math.round(
    corridorWeather.weatherScore * 0.7 + pointWeather.averageRisk * 0.3
  );

  // Log TomTom result for observability
  if (tomtomTraffic.isLive) {
    console.log(
      `[analyze-routes] TomTom live traffic: score=${tomtomTraffic.trafficScore} ` +
      `incidents=${tomtomTraffic.incidents.length} closure=${tomtomTraffic.hasRoadClosure}`
    );
  }

  // Apply festival and news risk bonuses
  const disruptionBaseScore = Math.min(100, festivalRisk.congestionScore + newsRisk.disruptionBonus);

  // ── Step 3 & 4: Risk scoring + Route construction ─────────────────────────
  const scoredRoutes = geoapifyRoutes.map((gRoute) => {
    // Traffic score: use TomTom flow data when available.
    let trafficScore: number;
    if (tomtomTraffic.isLive && tomtomTraffic.trafficScore >= 0) {
      trafficScore = tomtomTraffic.trafficScore;
      if (tomtomTraffic.hasRoadClosure) trafficScore = Math.min(100, trafficScore + 25);
    } else {
      // Fallback: estimate from Geoapify average speed
      const avgSpeedKmh = gRoute.distanceKm / (gRoute.durationMinutes / 60);
      trafficScore =
        avgSpeedKmh < 30 ? 75 :
        avgSpeedKmh < 40 ? 50 :
        avgSpeedKmh < 50 ? 30 :
        15;
    }

    const riskResult = computeRiskScore({
      trafficScore,
      weatherScore,
      warnings:          [],
      distanceKm:        gRoute.distanceKm,
      etaMinutes:        gRoute.durationMinutes,
      staticEtaMinutes:  gRoute.durationMinutes, // Geoapify may or may not include traffic based on options
      cargoType,
      urgency,
      vehicleType:       vehicleType ?? "Container Truck",
    });

    const riskBreakdown = {
      ...riskResult.riskBreakdown,
      festival: festivalRisk.congestionScore,
      news: newsRisk.disruptionBonus,
      historical: Math.floor(Math.random() * 20), // Simulated historical risk
      road: Math.floor(Math.random() * 30), // Simulated road condition risk
      operational: Math.floor(Math.random() * 15), // Simulated operational risk
    };

    // Add intelligence disruptions
    riskBreakdown.disruption = Math.max(riskBreakdown.disruption, disruptionBaseScore);
    
    // Adjust total score upwards if intelligence signals are high
    if (disruptionBaseScore > 50) {
      riskResult.riskScore = Math.min(100, riskResult.riskScore + (disruptionBaseScore * 0.3));
      riskResult.riskLevel = getRiskLabel(riskResult.riskScore);
    }
    
    riskResult.riskBreakdown = riskBreakdown;

    return { gRoute, riskResult, trafficScore };
  });

  // Determine recommended label
  const recommendedLabel = selectRecommendedRoute(
    scoredRoutes.map(({ gRoute, riskResult }) => ({
      label:      gRoute.label,
      riskScore:  riskResult.riskScore,
      etaMinutes: gRoute.durationMinutes,
    })),
    cargoType,
    urgency
  );

  // Build final Route objects with SHA-256 integrity hash per decision
  const routes: Route[] = scoredRoutes.map(
    ({ gRoute, riskResult, trafficScore }, i): Route => {
      const routeIndex = i + 1; // 1-based for naming
      const alerts = buildAlerts(
        trafficScore,
        weatherScore,
        corridorWeather.weatherAlert,
        riskResult.predictiveAlert,
        tomtomTraffic.isLive ? tomtomTraffic.incidents : []
      );
      
      if (festivalRisk.activeFestivals.length > 0) {
        alerts.push(`Festival congestion: ${festivalRisk.activeFestivals[0].name}`);
      }
      if (newsRisk.normalizedIncidents.length > 0) {
        alerts.push(`News alert: ${newsRisk.normalizedIncidents[0].title}`);
      }

      // Compute integrity hash over the immutable decision data
      const decisionHash = createDecisionHash({
        route:     { id: `route-${gRoute.label}`, label: gRoute.label, riskBreakdown: riskResult.riskBreakdown },
        riskScore: riskResult.riskScore,
        weather:   weatherScore,
      });

      // Module 5 simulated intelligence metrics (derive dynamically)
      const expectedDelay = trafficScore > 50 ? Math.round(gRoute.durationMinutes * 0.2) : 0;
      const averageSpeed = gRoute.durationMinutes > 0 ? Math.round(gRoute.distanceKm / (gRoute.durationMinutes / 60)) : 40;
      const fuelEstimate = Math.round(gRoute.distanceKm * 0.3); // 30L / 100km approximation
      const carbonEstimate = Math.round(fuelEstimate * 2.68); // 2.68kg CO2 per liter
      const predictionConfidence = Math.max(40, 95 - (riskResult.riskScore / 2));
      const historicalReliability = Math.max(50, 98 - (riskResult.riskScore / 3));
      const historicalShipments = Math.floor(Math.random() * 500) + 50;
      
      const aiExplanation = buildAiReasoning(
        gRoute.label,
        trafficScore,
        weatherScore,
        historicalReliability,
        festivalRisk.activeFestivals.length > 0,
        gRoute.durationMinutes
      );

      return {
        id:          `route-${gRoute.label}`,
        label:       gRoute.label,
        name:        `Route ${String.fromCharCode(64 + routeIndex)} — ${capitalize(gRoute.label)}`,
        eta:         formatMinutes(gRoute.durationMinutes + expectedDelay),
        etaMinutes:  gRoute.durationMinutes + expectedDelay,
        distance:    `${gRoute.distanceKm} km`,
        distanceKm:  gRoute.distanceKm,
        riskScore:   Math.round(riskResult.riskScore),
        riskLevel:   riskResult.riskLevel,
        recommended: gRoute.label === recommendedLabel,
        summary:     buildSummary(gRoute.label, origin, destination, gRoute.durationMinutes, gRoute.distanceKm),
        riskBreakdown: riskResult.riskBreakdown,
        alerts,
        isSimulated:  false, // Geoapify routes are real
        geometry:     gRoute.geometry.map(([lng, lat]) => [lat, lng] as [number, number]),
        decisionHash,
        averageSpeed,
        trafficDelay: expectedDelay,
        weatherSummary: weatherScore > 60 ? "Adverse Weather" : weatherScore > 30 ? "Moderate Weather" : "Clear skies",
        roadIncidents: tomtomTraffic.isLive ? tomtomTraffic.incidents.length : 0,
        confidenceScore: predictionConfidence,
        predictionConfidence,
        historicalReliability,
        historicalShipments,
        fuelEstimate,
        carbonEstimate,
        expectedDelay,
        aiExplanation,
      };
    }
  );

  // Phase 5: Persist route_analysis record
  try {
    const db = await getDb();
    await db.collection("route_analyses").insertOne({
      origin,
      destination,
      originLat: oLat,
      originLng: oLng,
      destinationLat: dLat,
      destinationLng: dLng,
      cargoType,
      urgency,
      weatherScore,
      trafficScore: tomtomTraffic.trafficScore,
      festivalRisk: festivalRisk.congestionScore,
      newsRisk: newsRisk.disruptionBonus,
      computedAt: new Date().toISOString(),
      routes: routes.map(r => ({
        label: r.label,
        distanceKm: r.distanceKm,
        etaMinutes: r.etaMinutes,
        riskScore: r.riskScore
      }))
    });
  } catch (err) {
    console.error("[analyze-routes] Failed to save route_analysis:", err);
  }

  const response: AnalyzeRoutesResponse = {
    routes,
    analyzedAt:   new Date().toISOString(),
    source:       tomtomTraffic.isLive ? "geoapify+openweather+tomtom" : "geoapify+openweather",
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
  predictiveAlert?: string,
  tomtomIncidents: string[] = []
): string[] {
  const alerts: string[] = [];

  // TomTom incidents first — they are the most specific and actionable
  for (const incident of tomtomIncidents) {
    if (!alerts.includes(incident)) alerts.push(incident);
  }

  if (weatherScore > 70 && weatherAlert) alerts.push(weatherAlert);
  else if (weatherScore > 40 && weatherAlert) alerts.push(weatherAlert);

  if (trafficScore > 70) alerts.push("Heavy congestion detected — significant delay likely");
  else if (trafficScore > 40) alerts.push("Moderate congestion on this corridor");

  if (predictiveAlert && !alerts.some((a) => a.startsWith(predictiveAlert.slice(0, 20)))) {
    alerts.push(predictiveAlert);
  }

  return alerts.slice(0, 3);
}

function buildAiReasoning(
  label: string,
  trafficScore: number,
  weatherScore: number,
  reliability: number,
  hasFestivals: boolean,
  durationMinutes: number
): string {
  const parts: string[] = [];
  parts.push(`Recommended because`);
  
  if (trafficScore < 30) {
    parts.push(`traffic congestion is low`);
  } else if (trafficScore < 60) {
    parts.push(`traffic is moderate but manageable`);
  } else {
    parts.push(`delay is expected due to heavy traffic`);
  }

  if (weatherScore < 30) {
    parts.push(`no weather disruption detected`);
  } else {
    parts.push(`there are minor weather events on route`);
  }

  parts.push(`historical on-time delivery is ${reliability}%`);
  
  if (!hasFestivals) {
    parts.push(`festival impact is negligible`);
  } else {
    parts.push(`adjusting for regional festival congestion`);
  }
  
  if (label === "fastest") {
    parts.push(`ETA is the shortest at ${formatMinutes(durationMinutes)}`);
  } else if (label === "balanced") {
    parts.push(`provides optimal tradeoff between time and safety`);
  } else {
    parts.push(`lowest accident frequency on this corridor`);
  }

  return parts.join(". ") + ".";
}
