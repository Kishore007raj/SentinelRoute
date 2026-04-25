import { NextRequest, NextResponse } from "next/server";
import { geocode, getOsrmRoute } from "@/lib/osrm";
import { getRouteWeatherRisk } from "@/lib/weather-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin, destination } = body;

    if (!origin || !destination) {
      return NextResponse.json({ success: false, error: "Origin and destination are required" }, { status: 400 });
    }

    // 1. Geocode origin and destination
    const [originCoords, destCoords] = await Promise.all([
      geocode(origin),
      geocode(destination)
    ]);

    if (!originCoords || !destCoords) {
      return NextResponse.json({ success: false, error: "Could not locate origin or destination" }, { status: 400 });
    }

    // 2. Call OSRM for the route
    const osrmRoute = await getOsrmRoute(originCoords[0], originCoords[1], destCoords[0], destCoords[1]);
    
    if (!osrmRoute) {
      return NextResponse.json({ success: false, error: "Route unavailable" }, { status: 400 });
    }

    // 3. Integrate Weather System (MANDATORY sampling)
    const weatherResult = await getRouteWeatherRisk(osrmRoute.geometry.coordinates);

    // 4. Return structured response as required
    return NextResponse.json({
      success: true,
      data: {
        distanceKm: osrmRoute.distanceKm,
        durationHours: osrmRoute.durationHours,
        geometry: osrmRoute.geometry.coordinates, // OSRM returns [lng, lat]
        weatherScore: weatherResult.averageRisk || 1 // Fallback to 1 as requested
      }
    });

  } catch (error) {
    console.error("Unified Route API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
