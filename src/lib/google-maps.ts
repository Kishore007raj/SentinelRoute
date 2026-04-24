/**
 * google-maps.ts — Google Maps Routes API client.
 *
 * Calls the Routes API (v2) to compute up to 3 route alternatives
 * between an origin and destination.
 *
 * API docs: https://developers.google.com/maps/documentation/routes
 *
 * Server-side only — uses GOOGLE_MAPS_API_KEY (no NEXT_PUBLIC_ prefix).
 */

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

// ─── Request / Response types (subset of the full API) ────────────────────────

interface LatLng {
  latitude: number;
  longitude: number;
}

interface Waypoint {
  address?: string;
  location?: { latLng: LatLng };
}

interface MapsRoutesRequest {
  origin: Waypoint;
  destination: Waypoint;
  travelMode: "DRIVE";
  routingPreference: "TRAFFIC_AWARE" | "TRAFFIC_AWARE_OPTIMAL" | "TRAFFIC_UNAWARE";
  computeAlternativeRoutes: boolean;
  routeModifiers?: {
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    avoidFerries?: boolean;
  };
  languageCode: string;
  units: "METRIC" | "IMPERIAL";
}

export interface MapsRoute {
  distanceMeters: number;
  duration: string;           // e.g. "14400s"
  staticDuration: string;     // without traffic
  polyline: {
    encodedPolyline: string;
  };
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

export interface MapsRoutesResponse {
  routes: MapsRoute[];
}

// ─── City → geocode lookup (India logistics hubs) ────────────────────────────
// Used to convert city names to lat/lng for the API request.
// Covers all cities in the app's LOCATION_OPTIONS.

const CITY_COORDS: Record<string, LatLng> = {
  Chennai:     { latitude: 13.0827, longitude: 80.2707 },
  Bangalore:   { latitude: 12.9716, longitude: 77.5946 },
  Hyderabad:   { latitude: 17.3850, longitude: 78.4867 },
  Pune:        { latitude: 18.5204, longitude: 73.8567 },
  Mumbai:      { latitude: 19.0760, longitude: 72.8777 },
  Coimbatore:  { latitude: 11.0168, longitude: 76.9558 },
  Salem:       { latitude: 11.6643, longitude: 78.1460 },
  Thrissur:    { latitude: 10.5276, longitude: 76.2144 },
  Vijayawada:  { latitude: 16.5062, longitude: 80.6480 },
};

function cityToWaypoint(city: string): Waypoint {
  const coords = CITY_COORDS[city];
  if (coords) {
    return { location: { latLng: coords } };
  }
  // Fall back to address string if city not in lookup
  return { address: `${city}, India` };
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Fetches up to 3 route alternatives from Google Maps Routes API.
 *
 * Returns null if:
 * - API key is missing
 * - API call fails
 * - No routes returned
 *
 * Caller should fall back to static routes on null.
 */
export async function fetchGoogleRoutes(
  origin: string,
  destination: string
): Promise<MapsRoute[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn("[google-maps] GOOGLE_MAPS_API_KEY not set — using static routes");
    return null;
  }

  const requestBody: MapsRoutesRequest = {
    origin:      cityToWaypoint(origin),
    destination: cityToWaypoint(destination),
    travelMode:  "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: true,
    languageCode: "en-US",
    units: "METRIC",
  };

  try {
    const res = await fetch(ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Request only the fields we need — reduces response size and cost
        "X-Goog-FieldMask": [
          "routes.distanceMeters",
          "routes.duration",
          "routes.staticDuration",
          "routes.polyline.encodedPolyline",
          "routes.description",
          "routes.warnings",
          "routes.travelAdvisory.speedReadingIntervals",
        ].join(","),
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[google-maps] API error ${res.status}:`, errText);
      return null;
    }

    const data: MapsRoutesResponse = await res.json();

    if (!data.routes || data.routes.length === 0) {
      console.warn("[google-maps] No routes returned for", origin, "→", destination);
      return null;
    }

    return data.routes;
  } catch (err) {
    console.error("[google-maps] Fetch failed:", err);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses a Google duration string like "14400s" into minutes.
 */
export function parseDurationToMinutes(duration: string): number {
  const match = duration.match(/^(\d+)s$/);
  if (!match) return 0;
  return Math.round(parseInt(match[1], 10) / 60);
}

/**
 * Formats minutes into a human-readable string like "4h 20m".
 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Estimates a traffic congestion score (0–100) from speed reading intervals.
 * Higher score = more congestion.
 */
export function estimateTrafficScore(route: MapsRoute): number {
  const intervals = route.travelAdvisory?.speedReadingIntervals ?? [];
  if (intervals.length === 0) {
    // No traffic data — estimate from duration delta
    const staticMins = parseDurationToMinutes(route.staticDuration);
    const trafficMins = parseDurationToMinutes(route.duration);
    if (staticMins === 0) return 20;
    const ratio = trafficMins / staticMins;
    // ratio 1.0 = no delay, 1.5+ = heavy traffic
    return Math.min(100, Math.round((ratio - 1) * 200));
  }

  const counts = { NORMAL: 0, SLOW: 0, TRAFFIC_JAM: 0 };
  for (const interval of intervals) {
    counts[interval.speed] = (counts[interval.speed] ?? 0) + 1;
  }
  const total = intervals.length;
  const score = Math.round(
    ((counts.SLOW * 50 + counts.TRAFFIC_JAM * 100) / total)
  );
  return Math.min(100, score);
}
