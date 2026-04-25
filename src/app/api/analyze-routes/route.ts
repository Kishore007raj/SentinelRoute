import { NextRequest, NextResponse } from "next/server";
import { geocode, getOsrmRoute } from "@/lib/osrm";
import { getRouteWeatherRisk } from "@/lib/weather-service";
import { computeRisk } from "@/lib/risk";
import { Route, RouteLabel } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin, destination, cargoType, vehicleType, urgency } = body;

    if (!origin || !destination) {
      return NextResponse.json({ error: "Origin and destination are required" }, { status: 400 });
    }

    // 1. Convert city -> coordinates
    const [originCoords, destCoords] = await Promise.all([
      geocode(origin),
      geocode(destination)
    ]);

    if (!originCoords || !destCoords) {
      return NextResponse.json({ error: "Could not geocode origin or destination" }, { status: 400 });
    }

    // 2. Call OSRM
    const osrmRoute = await getOsrmRoute(originCoords[0], originCoords[1], destCoords[0], destCoords[1]);
    if (!osrmRoute) {
      return NextResponse.json({ error: "Could not find a route" }, { status: 400 });
    }

    // 3. Sample route -> weather
    const weatherResult = await getRouteWeatherRisk(osrmRoute.geometry.coordinates);

    // 4. Compute risk for the main route
    const mainRisk = computeRisk(
      osrmRoute.distanceKm,
      osrmRoute.durationHours,
      weatherResult.averageRisk,
      cargoType,
      urgency
    );

    // 5. Generate 3 routes (Simulate variations based on the real OSRM route)
    const labels: RouteLabel[] = ["fastest", "balanced", "safest"];
    const routes: Route[] = labels.map((label) => {
      let riskAdjustment = 0;
      let timeAdjustment = 1;
      let distAdjustment = 1;

      if (label === "fastest") {
        riskAdjustment = 5;
        timeAdjustment = 1;
        distAdjustment = 1;
      } else if (label === "balanced") {
        riskAdjustment = 0;
        timeAdjustment = 1.1;
        distAdjustment = 1.05;
      } else if (label === "safest") {
        riskAdjustment = -10;
        timeAdjustment = 1.25;
        distAdjustment = 1.15;
      }

      const distanceKm = osrmRoute.distanceKm * distAdjustment;
      const durationHours = osrmRoute.durationHours * timeAdjustment;
      const { score, level } = computeRisk(
        distanceKm,
        durationHours,
        weatherResult.averageRisk + riskAdjustment,
        cargoType,
        urgency
      );

      return {
        id: `route-${label}-${Math.random().toString(36).substr(2, 9)}`,
        label,
        name: `Route via ${label === "fastest" ? "Primary Highway" : label === "balanced" ? "National Corridor" : "Expressway Bypass"}`,
        distanceKm,
        durationHours,
        riskScore: score,
        riskLevel: level,
        recommended: label === "balanced", // Default to balanced
        summary: `A ${label} route from ${origin} to ${destination}.`,
        riskBreakdown: {
          traffic: 20 + riskAdjustment,
          weather: weatherResult.averageRisk,
          disruption: 10,
          cargoSensitivity: 15
        },
        alerts: score > 50 ? ["High risk detected on this corridor"] : [],
        routeGeometry: osrmRoute.geometry,
      };
    });

    // Smart recommendation
    const recommendedIdx = urgency === "Critical" ? 0 : cargoType === "Pharmaceuticals" ? 2 : 1;
    routes.forEach((r, i) => r.recommended = (i === recommendedIdx));

    return NextResponse.json({
      routes,
      analyzedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Analyze Routes API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
