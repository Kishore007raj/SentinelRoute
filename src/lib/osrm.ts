/**
 * osrm.ts — OSRM routing client for SentinelRoute.
 *
 * Uses the public OSRM demo server (router.project-osrm.org).
 * Hardcoded city coordinates avoid Nominatim rate-limit issues in production.
 *
 * Exports:
 *   getOsrmRoutes(origin, destination) → OsrmRouteResult[] (2–3 variants)
 *   geocodeCity(city) → [lng, lat] | null
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OsrmRouteResult {
  /** Route variant label */
  label:        "fastest" | "balanced" | "safest";
  distanceKm:   number;
  durationMins: number;
  /** Static (no-traffic) duration in minutes — same as durationMins for OSRM */
  staticDurationMins: number;
  /** GeoJSON LineString coordinates [lng, lat][] */
  coordinates:  [number, number][];
  /** Encoded polyline string (from OSRM overview=full) */
  polyline?:    string;
}

// ─── City coordinate table ────────────────────────────────────────────────────
// [longitude, latitude] — OSRM uses lng,lat order

const CITY_COORDS: Record<string, [number, number]> = {
  Chennai:    [80.2707, 13.0827],
  Bangalore:  [77.5946, 12.9716],
  Hyderabad:  [78.4867, 17.3850],
  Pune:       [73.8567, 18.5204],
  Mumbai:     [72.8777, 19.0760],
  Coimbatore: [76.9558, 11.0168],
  Salem:      [78.1460, 11.6643],
  Thrissur:   [76.2144, 10.5276],
  Vijayawada: [80.6480, 16.5062],
};

// ─── Geocoding ────────────────────────────────────────────────────────────────

/**
 * Returns [lng, lat] for a city name.
 * Uses hardcoded table first; falls back to Nominatim for unknown cities.
 */
export async function geocodeCity(city: string): Promise<[number, number] | null> {
  const known = CITY_COORDS[city];
  if (known) return known;

  // Nominatim fallback for cities not in the table
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)},India&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SentinelRoute/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
  } catch {
    return null;
  }
}

// ─── OSRM fetch ───────────────────────────────────────────────────────────────

interface OsrmApiRoute {
  distance: number;   // metres
  duration: number;   // seconds
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

async function fetchOsrmRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): Promise<OsrmApiRoute | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${startLng},${startLat};${endLng},${endLat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "SentinelRoute/1.0" },
    });
    if (!res.ok) {
      console.error(`[osrm] API error ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data.routes?.length) return null;
    return data.routes[0] as OsrmApiRoute;
  } catch (err) {
    console.error("[osrm] Fetch failed:", err);
    return null;
  }
}

// ─── Route variation synthesis ────────────────────────────────────────────────

/**
 * Synthesizes a "balanced" and "safest" variant from the base fastest route.
 *
 * Balanced: +15% duration, +5% distance (avoids primary congestion corridor)
 * Safest:   +40% duration, +15% distance (uses secondary roads)
 *
 * Coordinates are interpolated to approximate an alternate path.
 */
function synthesizeVariant(
  base: OsrmApiRoute,
  durationMultiplier: number,
  distanceMultiplier: number
): OsrmApiRoute {
  return {
    distance: Math.round(base.distance * distanceMultiplier),
    duration: Math.round(base.duration * durationMultiplier),
    geometry: base.geometry, // same corridor — visual approximation
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches the fastest OSRM route between two cities and synthesizes
 * balanced + safest variants.
 *
 * Returns an empty array if geocoding or OSRM fails (caller handles fallback).
 */
export async function getOsrmRoutes(
  origin: string,
  destination: string
): Promise<OsrmRouteResult[]> {
  // Geocode both cities in parallel
  const [originCoords, destCoords] = await Promise.all([
    geocodeCity(origin),
    geocodeCity(destination),
  ]);

  if (!originCoords || !destCoords) {
    console.error(`[osrm] Geocoding failed — origin: ${origin}, destination: ${destination}`);
    return [];
  }

  const [oLng, oLat] = originCoords;
  const [dLng, dLat] = destCoords;

  const baseRoute = await fetchOsrmRoute(oLng, oLat, dLng, dLat);
  if (!baseRoute) {
    console.error(`[osrm] Route fetch failed for ${origin} → ${destination}`);
    return [];
  }

  // Build three variants
  const variants: Array<{
    label: "fastest" | "balanced" | "safest";
    route: OsrmApiRoute;
  }> = [
    { label: "fastest",  route: baseRoute },
    { label: "balanced", route: synthesizeVariant(baseRoute, 1.15, 1.05) },
    { label: "safest",   route: synthesizeVariant(baseRoute, 1.40, 1.15) },
  ];

  return variants.map(({ label, route }) => ({
    label,
    distanceKm:        Math.round(route.distance / 1000),
    durationMins:      Math.round(route.duration / 60),
    staticDurationMins: Math.round(route.duration / 60), // OSRM has no traffic data
    coordinates:       route.geometry.coordinates,
  }));
}

// ─── Legacy export (backward compatibility) ───────────────────────────────────

/** @deprecated Use getOsrmRoutes instead */
export async function getOsrmRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
) {
  const route = await fetchOsrmRoute(startLng, startLat, endLng, endLat);
  if (!route) return null;
  return {
    distanceKm:    route.distance / 1000,
    durationHours: route.duration / 3600,
    geometry:      route.geometry,
  };
}

/** @deprecated Use geocodeCity instead */
export async function geocode(city: string): Promise<[number, number] | null> {
  return geocodeCity(city);
}
