import { NextRequest, NextResponse } from "next/server";
import { generateExplanation } from "@/lib/gemini";
import type { Route } from "@/lib/types";

/**
 * POST /api/ai-insight
 * Generates a Gemini AI explanation for a selected route.
 */
export async function POST(req: NextRequest) {
  let body: {
    origin: string;
    destination: string;
    cargoType: string;
    vehicleType: string;
    urgency: string;
    selectedRoute: Route;
    allRoutes: Route[];
    weatherScore?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { origin, destination, cargoType, vehicleType, urgency, selectedRoute, allRoutes } = body;

  if (!origin || !destination || !selectedRoute || !allRoutes) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const r = selectedRoute;
  const breakdown = r.riskBreakdown;
  const weatherScore = body.weatherScore ?? 20;

  // Find dominant risk factor
  const factors = [
    { name: "traffic congestion", score: breakdown.traffic },
    { name: "weather conditions", score: breakdown.weather },
    { name: "route disruption",   score: breakdown.disruption },
    { name: "cargo sensitivity",  score: breakdown.cargoSensitivity },
  ].sort((a, b) => b.score - a.score);
  const dominantFactor = factors[0]?.name ?? "overall risk";

  const alternatives = allRoutes
    .filter((alt) => alt.id !== r.id)
    .map((alt) => `${alt.label} (risk: ${alt.riskScore}, ETA: ${alt.eta})`)
    .join(", ");

  const prompt = `You are a logistics risk analyst for SentinelRoute.

Shipment: ${origin} → ${destination}
Cargo: ${cargoType} | Vehicle: ${vehicleType} | Urgency: ${urgency}

Selected route: ${r.name}
- Risk score: ${r.riskScore}/100 (${r.riskLevel})
- ETA: ${r.eta} | Distance: ${r.distance}
- Traffic: ${breakdown.traffic}/100 | Weather: ${weatherScore}/100 | Disruption: ${breakdown.disruption}/100 | Cargo sensitivity: ${breakdown.cargoSensitivity}/100
- Alerts: ${r.alerts.length > 0 ? r.alerts.join("; ") : "none"}
- Alternatives: ${alternatives}

Write 2–3 sentences explaining why this route was selected or flagged. Focus on the dominant factor (${dominantFactor}), what it means for this cargo, and one actionable recommendation. Be direct. No bullet points. No generic phrases.`;

  const explanation = await generateExplanation(prompt);

  // generateExplanation returns null on failure/timeout — pass through directly
  return NextResponse.json({ explanation });
}
