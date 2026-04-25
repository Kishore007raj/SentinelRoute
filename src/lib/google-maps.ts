/**
 * google-maps.ts — Google Maps Routes API client.
 * Server-side only — uses GOOGLE_MAPS_API_KEY.
 */

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

interface LatLng { latitude: number; longitude: number; }
interface Waypoint { address?: string; location?: { latLng: LatLng }; }

export interface MapsRoute {
  distanceMeters: number;
  duration: string;
  staticDuration: string;
  polyline: { encodedPolyline: string };
  description?: string;
  warnings?: string[];
  travelAdvisory?: {
    tollInfo?: unknown;
    speedReadingIntervals?: Array<{
      startPolylinePointIndex: number;
      endPolylinePointIndex: number;
      speed: "NORMAL" | "SLOW" | "TRAFFIC_JAM";
    }>;
  };
}

const CITY_COORDS: Record<string, LatLng> = {
  Chennai:    { latitude: 13.0827, longitude: 80.2707 },
  Bangalore:  { latitude: 12.9716, longitude: 77.5946 },
  Hyderabad:  { latitude: 17.3850, longitude: 78.4867 },
  Pune:       { latitude: 18.5204, longitude: 73.8567 },
  Mumbai:     { latitude: 19.0760, longitude: 72.8777 },
  Coimbatore: { latitude: 11.0168, longitude: 76.9558 },
  Salem:      { latitude: 11.6643, longitude: 78.1460 },
  Thrissur:   { latitude: 10.5276, longitude: 76.2144 },
  Vijayawada: { latitude: 16.5062, longitude: 80.6480 },
};

function cityToWaypoint(city: string): Waypoint {
  const coords = CITY_COORDS[city];
  return coords
    ? { location: { latLng: coords } }
    : { address: `${city}, India` };
}

export async function fetchGoogleRoutes(
  origin: string,
  destination: string
): Promise<MapsRoute[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("[google-maps] GOOGLE_MAPS_API_KEY not set — using static routes");
    return null;
  }

  try {
    const res = await fetch(ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "routes.distanceMeters", "routes.duration", "routes.staticDuration",
          "routes.polyline.encodedPolyline", "routes.description",
          "routes.warnings", "routes.travelAdvisory.speedReadingIntervals",
        ].join(","),
      },
      body: JSON.stringify({
        origin: cityToWaypoint(origin),
        destination: cityToWaypoint(destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: true,
        languageCode: "en-US",
        units: "METRIC",
      }),
    });

    if (!res.ok) { console.error(`[google-maps] API error ${res.status}`); return null; }
    const data = await res.json();
    return data.routes?.length ? data.routes : null;
  } catch (err) {
    console.error("[google-maps] Fetch failed:", err);
    return null;
  }
}

export function parseDurationToMinutes(duration: string): number {
  const match = duration.match(/^(\d+)s$/);
  return match ? Math.round(parseInt(match[1], 10) / 60) : 0;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function estimateTrafficScore(route: MapsRoute): number {
  const intervals = route.travelAdvisory?.speedReadingIntervals ?? [];
  if (intervals.length === 0) {
    const staticMins = parseDurationToMinutes(route.staticDuration);
    const trafficMins = parseDurationToMinutes(route.duration);
    if (staticMins === 0) return 20;
    return Math.min(100, Math.round((trafficMins / staticMins - 1) * 200));
  }
  const counts = { NORMAL: 0, SLOW: 0, TRAFFIC_JAM: 0 };
  for (const i of intervals) counts[i.speed] = (counts[i.speed] ?? 0) + 1;
  return Math.min(100, Math.round((counts.SLOW * 50 + counts.TRAFFIC_JAM * 100) / intervals.length));
}
