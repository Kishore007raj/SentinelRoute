import { NextRequest, NextResponse } from "next/server";
import type { Route, AnalyzeRoutesRequest, AnalyzeRoutesResponse } from "@/lib/types";
import { getRiskLabel } from "@/lib/utils";

/**
 * POST /api/analyze-routes
 *
 * Layer 1: Returns 3 fully type-correct static routes.
 * Values are logically varied by label (fastest / balanced / safest).
 * No external APIs. No risk engine. Pure in-memory.
 *
 * Every Route object includes ALL required fields with no undefined values.
 */
export async function POST(req: NextRequest) {
  let raw: Record<string, unknown>;

  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { origin, destination, cargoType, urgency } = raw as AnalyzeRoutesRequest;

  if (!origin || typeof origin !== "string") {
    return NextResponse.json({ error: "Missing required field: origin" }, { status: 400 });
  }
  if (!destination || typeof destination !== "string") {
    return NextResponse.json({ error: "Missing required field: destination" }, { status: 400 });
  }
  if (!cargoType || typeof cargoType !== "string") {
    return NextResponse.json({ error: "Missing required field: cargoType" }, { status: 400 });
  }
  if (!urgency || typeof urgency !== "string") {
    return NextResponse.json({ error: "Missing required field: urgency" }, { status: 400 });
  }

  const routes = buildRoutes(origin, destination, cargoType, urgency);

  const response: AnalyzeRoutesResponse = {
    routes,
    analyzedAt: new Date().toISOString(),
    source:     "static",
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

// ─── Static route builder ─────────────────────────────────────────────────────

function buildRoutes(
  origin: string,
  destination: string,
  cargoType: string,
  urgency: string
): Route[] {
  const isCritical  = urgency === "Critical";
  const isColdChain = cargoType === "Cold Chain Goods" || cargoType === "Pharmaceuticals";
  const cargoMod    = isColdChain ? 20 : cargoType === "Electronics" ? 10 : 0;

  // Three logically varied route bases
  const bases = [
    {
      id:          "route-a",
      label:       "fastest"  as const,
      name:        "Route A — Fastest",
      etaMinutes:  260,
      distanceKm:  347,
      riskScore:   72,
      traffic:     80,
      weather:     25,
      disruption:  65,
      cargoSens:   Math.min(100, 55 + cargoMod),
      alerts:      [
        "Congestion expected near primary toll corridor",
        "Roadwork may add 22 minutes to arrival",
      ],
      recommended: isCritical,
    },
    {
      id:          "route-b",
      label:       "balanced" as const,
      name:        "Route B — Balanced",
      etaMinutes:  305,
      distanceKm:  362,
      riskScore:   37,
      traffic:     40,
      weather:     20,
      disruption:  30,
      cargoSens:   Math.min(100, 25 + cargoMod),
      alerts:      ["Minor congestion possible near bypass"],
      recommended: !isCritical && !isColdChain,
    },
    {
      id:          "route-c",
      label:       "safest"   as const,
      name:        "Route C — Safest",
      etaMinutes:  370,
      distanceKm:  398,
      riskScore:   14,
      traffic:     12,
      weather:     10,
      disruption:  8,
      cargoSens:   Math.min(100, 8 + cargoMod),
      alerts:      [] as string[],
      recommended: isColdChain,
    },
  ];

  const summaries: Record<string, string> = {
    fastest:  `Fastest path from ${origin} to ${destination}. Elevated risk due to congestion and disruption on the primary corridor.`,
    balanced: `Balanced route from ${origin} to ${destination}. Good tradeoff between travel time and disruption risk.`,
    safest:   `Lowest-risk route from ${origin} to ${destination}. Longer path but minimal disruption probability. Ideal for sensitive cargo.`,
  };

  // Build fully typed Route objects — every required field explicitly set
  return bases.map((b): Route => ({
    id:           b.id,
    label:        b.label,
    name:         b.name,
    eta:          formatMinutes(b.etaMinutes),   // string: "4h 20m"
    etaMinutes:   b.etaMinutes,                  // number
    distance:     `${b.distanceKm} km`,          // string: "347 km"
    distanceKm:   b.distanceKm,                  // number
    riskScore:    b.riskScore,                   // number
    riskLevel:    getRiskLabel(b.riskScore),     // RiskLevel
    recommended:  b.recommended,                 // boolean
    summary:      summaries[b.label] ?? "",      // string — never undefined
    riskBreakdown: {
      traffic:          b.traffic,
      weather:          b.weather,
      disruption:       b.disruption,
      cargoSensitivity: b.cargoSens,
    },
    alerts:       b.alerts,                      // string[] — never undefined
    // polyline is optional — omitted intentionally (no Maps API in Layer 1)
  }));
}
