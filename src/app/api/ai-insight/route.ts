import { NextRequest, NextResponse } from "next/server";
import { generateRouteExplanation } from "@/lib/gemini";
import type { Route } from "@/lib/types";

/**
 * POST /api/ai-insight
 *
 * Generates a Gemini AI explanation for a selected route.
 * Called after the user selects a route on the routes page.
 *
 * Request body:
 * {
 *   origin: string
 *   destination: string
 *   cargoType: string
 *   vehicleType: string
 *   urgency: string
 *   selectedRoute: Route
 *   allRoutes: Route[]
 *   weatherScore: number
 * }
 *
 * Response:
 * { explanation: string | null }
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

  const {
    origin, destination, cargoType, vehicleType,
    urgency, selectedRoute, allRoutes,
  } = body;

  if (!origin || !destination || !selectedRoute || !allRoutes) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const explanation = await generateRouteExplanation({
    origin,
    destination,
    cargoType:     cargoType     ?? "General Freight",
    vehicleType:   vehicleType   ?? "Container Truck",
    urgency:       urgency       ?? "Standard",
    selectedRoute,
    allRoutes,
    weatherScore:  body.weatherScore ?? 20,
  });

  return NextResponse.json({ explanation });
}
