/**
 * geoapify.ts - Geoapify API integration for SentinelRoute.
 *
 * Capabilities:
 *   1. Autosuggest      - free-text -> place suggestions
 *   2. Geocode          - placeId -> lat/lng + address
 *   3. Reverse Geocode  - lat/lng -> place name + address
 *   4. Route Distance   - origin coords -> destination coords -> km + duration
 *   5. Route ETA        - same as above, returns duration in minutes
 *
 * All functions:
 *   - Read GEOAPIFY_API_KEY from env.ts (lazy accessor)
 *   - Enforce a 10-second hard timeout
 *   - Return null / [] on failure - callers handle fallback
 *
 * Server-side only. Do not import in client components.
 */

import { GEOAPIFY_API_KEY } from "./env";

// --- Type definitions ---

export interface GeoapifySuggestion {
  placeId:      string;
  placeName:    string;
  placeAddress: string;
  lat:          number | null;
  lng:          number | null;
  type:         string;
}

export interface GeoapifyPlace {
  placeId:      string;
  placeName:    string;
  placeAddress: string;
  lat:          number;
  lng:          number;
}

export interface GeoapifyRouteResult {
  distanceKm:      number;
  durationMinutes: number;
  /** GeoJSON LineString coordinates [[lng, lat], ...] */
  geometry:        [number, number][];
}

// --- Internal fetch helper ---

const GEOAPIFY_BASE = "https://api.geoapify.com";
const TIMEOUT_MS  = 10_000;

async function geoapifyFetch<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept":     "application/json",
        "User-Agent": "SentinelRoute/1.0",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error(`[geoapify] HTTP ${res.status} for ${url.split("?")[0]}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timer);
    const name = (err as { name?: string }).name;
    if (name === "AbortError") {
      console.warn("[geoapify] Request timed out");
    } else {
      console.error("[geoapify] Fetch failed:", err);
    }
    return null;
  }
}

// --- 1. Autosuggest ---

interface GeoapifyFeature {
  properties: {
    place_id?: string;
    formatted?: string;
    name?: string;
    address_line1?: string;
    address_line2?: string;
    lat?: number;
    lon?: number;
    category?: string;
    country_code?: string;
  };
}

interface GeoapifyFeatureCollection {
  features?: GeoapifyFeature[];
}

/**
 * Returns up to 10 place suggestions matching the query string.
 * Returns [] if the API is unavailable or the query is too short.
 */
export async function geoapifyAutosuggest(query: string): Promise<GeoapifySuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  const apiKey = GEOAPIFY_API_KEY();
  if (!apiKey) {
    console.warn("[geoapify] GEOAPIFY_API_KEY not set - autosuggest unavailable");
    return [];
  }

  // Bias towards India using filter=countrycode:in
  const url =
    `${GEOAPIFY_BASE}/v1/geocode/autocomplete` +
    `?text=${encodeURIComponent(query.trim())}` +
    `&filter=countrycode:in` +
    `&limit=10` +
    `&apiKey=${apiKey}`;

  const data = await geoapifyFetch<GeoapifyFeatureCollection>(url);
  if (!data?.features) return [];

  return data.features.map((feature) => {
    const p = feature.properties;
    return {
      placeId:      p.place_id ?? "",
      placeName:    p.name || p.address_line1 || p.formatted || "",
      placeAddress: p.formatted ?? "",
      lat:          p.lat != null ? Number(p.lat) : null,
      lng:          p.lon != null ? Number(p.lon) : null,
      type:         p.category ?? "place",
    };
  });
}

// --- 2. Geocode (placeId -> lat/lng) ---

/**
 * Resolves a Geoapify place_id to coordinates + address.
 * Returns null if the place is not found or the API is unavailable.
 */
export async function geoapifyGeocode(placeId: string): Promise<GeoapifyPlace | null> {
  if (!placeId) return null;

  const apiKey = GEOAPIFY_API_KEY();
  if (!apiKey) return null;

  const url =
    `${GEOAPIFY_BASE}/v1/geocode/place` +
    `?id=${encodeURIComponent(placeId)}` +
    `&apiKey=${apiKey}`;

  const data = await geoapifyFetch<GeoapifyFeatureCollection>(url);
  const feature = data?.features?.[0];
  if (!feature) return null;

  const p = feature.properties;
  const lat = p.lat != null ? Number(p.lat) : NaN;
  const lng = p.lon != null ? Number(p.lon) : NaN;

  if (isNaN(lat) || isNaN(lng)) return null;

  return {
    placeId,
    placeName:    String(p.name || p.address_line1 || p.formatted || placeId),
    placeAddress: String(p.formatted ?? ""),
    lat,
    lng,
  };
}

// --- 3. Reverse Geocode (lat/lng -> name + address) ---

/**
 * Resolves latitude/longitude to a human-readable place name and address.
 * Returns null on failure.
 */
export async function geoapifyReverseGeocode(
  lat: number,
  lng: number
): Promise<{ placeName: string; placeAddress: string } | null> {
  const apiKey = GEOAPIFY_API_KEY();
  if (!apiKey) return null;

  const url =
    `${GEOAPIFY_BASE}/v1/geocode/reverse` +
    `?lat=${lat}&lon=${lng}` +
    `&apiKey=${apiKey}`;

  const data = await geoapifyFetch<GeoapifyFeatureCollection>(url);
  const feature = data?.features?.[0];
  if (!feature) return null;

  const p = feature.properties;
  return {
    placeName:    p.name || p.address_line1 || p.formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    placeAddress: p.formatted ?? "",
  };
}

// --- 4 & 5. Route (distance + ETA) ---

interface GeoapifyRouteFeature {
  properties: {
    distance?: number;
    time?: number;
  };
  geometry: {
    coordinates: [number, number][] | [number, number][][];
    type: string;
  };
}

interface GeoapifyRoutingResponse {
  features?: GeoapifyRouteFeature[];
}

/**
 * Fetches driving route between two coordinate pairs via Geoapify Routing API.
 * Returns up to 3 alternative routes if available.
 *
 * @param originLng   Origin longitude
 * @param originLat   Origin latitude
 * @param destLng     Destination longitude
 * @param destLat     Destination latitude
 * @returns GeoapifyRouteResult[] or [] if unavailable
 */
export async function geoapifyRoute(
  originLng: number,
  originLat: number,
  destLng:   number,
  destLat:   number
): Promise<GeoapifyRouteResult[]> {
  const apiKey = GEOAPIFY_API_KEY();
  if (!apiKey) {
    console.warn("[geoapify] GEOAPIFY_API_KEY not set - route unavailable");
    return [];
  }

  // Geoapify format: lat,lon|lat,lon
  const waypoints = `${originLat},${originLng}|${destLat},${destLng}`;

  const url =
    `${GEOAPIFY_BASE}/v1/routing` +
    `?waypoints=${waypoints}` +
    `&mode=drive` +
    `&details=instruction_details` + 
    `&alternatives=3` +
    `&apiKey=${apiKey}`;

  const data = await geoapifyFetch<GeoapifyRoutingResponse>(url);
  const features = data?.features ?? [];

  if (features.length === 0) {
    console.warn(`[geoapify] No route returned for ${waypoints}`);
    return [];
  }

  return features.map((feature) => {
    // Distance in meters, time in seconds
    const distanceMeters = feature.properties?.distance ?? 0;
    const timeSeconds = feature.properties?.time ?? 0;
    
    // Normalize geometry handling (LineString or MultiLineString)
    let coords: [number, number][] = [];
    if (feature.geometry?.type === "MultiLineString") {
      const multi = feature.geometry.coordinates as [number, number][][];
      coords = multi.flat();
    } else if (feature.geometry?.type === "LineString") {
      coords = feature.geometry.coordinates as [number, number][];
    }
    
    return {
      distanceKm:      Math.round(distanceMeters / 1000),
      durationMinutes: Math.round(timeSeconds / 60),
      geometry:        coords,
    };
  });
}

/**
 * Convenience: fetches route using coordinates stored on a shipment.
 * Wraps geoapifyRoute() with named parameters for clarity.
 */
export async function geoapifyRouteByCoords(
  origin: { lat: number; lng: number },
  dest:   { lat: number; lng: number }
): Promise<GeoapifyRouteResult[]> {
  return geoapifyRoute(origin.lng, origin.lat, dest.lng, dest.lat);
}
