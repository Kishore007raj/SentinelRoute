/**
 * mappls.ts — Mappls (MapMyIndia) API integration for SentinelRoute.
 *
 * Capabilities:
 *   1. Autosuggest      — free-text -> place suggestions
 *   2. Geocode          — placeId -> lat/lng + address
 *   3. Reverse Geocode  — lat/lng -> place name + address
 *   4. Route Distance   — origin coords -> destination coords -> km + duration
 *   5. Route ETA        — same as above, returns duration in minutes
 *
 * All functions:
 *   - Read MAPPLS_API_KEY from env.ts (lazy accessor)
 *   - Enforce a 10-second hard timeout
 *   - Return null / [] on failure — callers handle fallback
 *
 * Server-side only. Do not import in client components.
 */

import { MAPPLS_API_KEY } from "./env";

// --- Type definitions ---

export interface MapplsSuggestion {
  placeId:      string;
  placeName:    string;
  placeAddress: string;
  lat:          number | null;
  lng:          number | null;
  type:         string;
}

export interface MapplsPlace {
  placeId:      string;
  placeName:    string;
  placeAddress: string;
  lat:          number;
  lng:          number;
}

export interface MapplsRouteResult {
  distanceKm:      number;
  durationMinutes: number;
  /** GeoJSON LineString coordinates [[lng, lat], ...] */
  geometry:        [number, number][];
}

// --- Internal fetch helper ---

const MAPPLS_BASE = "https://atlas.mapmyindia.com";
const TIMEOUT_MS  = 10_000;

async function mapplsFetch<T>(url: string): Promise<T | null> {
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
      console.error(`[mappls] HTTP ${res.status} for ${url.split("?")[0]}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timer);
    const name = (err as { name?: string }).name;
    if (name === "AbortError") {
      console.warn("[mappls] Request timed out");
    } else {
      console.error("[mappls] Fetch failed:", err);
    }
    return null;
  }
}

// --- 1. Autosuggest ---

interface MapplsAutoSuggestResponse {
  suggestedLocations?: Array<{
    eLoc:          string;
    placeName:     string;
    placeAddress:  string;
    latitude?:     string | number;
    longitude?:    string | number;
    type?:         string;
  }>;
}

/**
 * Returns up to 10 place suggestions matching the query string.
 * Returns [] if the API is unavailable or the query is too short.
 */
export async function mapplsAutosuggest(query: string): Promise<MapplsSuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  const apiKey = MAPPLS_API_KEY();
  if (!apiKey) {
    console.warn("[mappls] MAPPLS_API_KEY not set — autosuggest unavailable");
    return [];
  }

  const url =
    `${MAPPLS_BASE}/api/suggest/v3/json` +
    `?query=${encodeURIComponent(query.trim())}` +
    `&region=IND` +
    `&pod=CITY,LOCALITY,POI` +
    `&access_token=${apiKey}`;

  const data = await mapplsFetch<MapplsAutoSuggestResponse>(url);
  if (!data?.suggestedLocations) return [];

  return data.suggestedLocations.slice(0, 10).map((loc) => ({
    placeId:      loc.eLoc,
    placeName:    loc.placeName,
    placeAddress: loc.placeAddress,
    lat:          loc.latitude  != null ? Number(loc.latitude)  : null,
    lng:          loc.longitude != null ? Number(loc.longitude) : null,
    type:         loc.type ?? "place",
  }));
}

// --- 2. Geocode (placeId -> lat/lng) ---

interface MapplsPlaceDetailResponse {
  place?: {
    lat?:          number | string;
    lng?:          number | string;
    placeName?:    string;
    placeAddress?: string;
  };
  lat?:          number | string;
  lng?:          number | string;
  placeName?:    string;
  placeAddress?: string;
}

/**
 * Resolves a Mappls placeId (eLoc) to coordinates + address.
 * Returns null if the place is not found or the API is unavailable.
 */
export async function mapplsGeocode(placeId: string): Promise<MapplsPlace | null> {
  if (!placeId) return null;

  const apiKey = MAPPLS_API_KEY();
  if (!apiKey) return null;

  const url =
    `${MAPPLS_BASE}/api/place/geocode/v3/json` +
    `?eLoc=${encodeURIComponent(placeId)}` +
    `&access_token=${apiKey}`;

  const data = await mapplsFetch<MapplsPlaceDetailResponse>(url);
  if (!data) return null;

  const raw = data.place ?? data;
  const lat  = raw.lat != null ? Number(raw.lat) : NaN;
  const lng  = raw.lng != null ? Number(raw.lng) : NaN;

  if (isNaN(lat) || isNaN(lng)) return null;

  return {
    placeId,
    placeName:    String(raw.placeName    ?? placeId),
    placeAddress: String(raw.placeAddress ?? ""),
    lat,
    lng,
  };
}

// --- 3. Reverse Geocode (lat/lng -> name + address) ---

interface MapplsRevGeoResponse {
  results?: Array<{
    formatted_address?: string;
    place_name?:        string;
  }>;
}

/**
 * Resolves latitude/longitude to a human-readable place name and address.
 * Returns null on failure.
 */
export async function mapplsReverseGeocode(
  lat: number,
  lng: number
): Promise<{ placeName: string; placeAddress: string } | null> {
  const apiKey = MAPPLS_API_KEY();
  if (!apiKey) return null;

  const url =
    `${MAPPLS_BASE}/api/reverse-geocode/v3/json` +
    `?lat=${lat}&lng=${lng}` +
    `&access_token=${apiKey}`;

  const data = await mapplsFetch<MapplsRevGeoResponse>(url);
  const first = data?.results?.[0];
  if (!first) return null;

  return {
    placeName:    first.place_name        ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    placeAddress: first.formatted_address ?? "",
  };
}

// --- 4 & 5. Route (distance + ETA) ---

interface MapplsDirectionsResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
}

/**
 * Fetches driving route between two coordinate pairs via Mappls Route API.
 *
 * @param originLng   Origin longitude
 * @param originLat   Origin latitude
 * @param destLng     Destination longitude
 * @param destLat     Destination latitude
 * @returns MapplsRouteResult or null if unavailable
 */
export async function mapplsRoute(
  originLng: number,
  originLat: number,
  destLng:   number,
  destLat:   number
): Promise<MapplsRouteResult[]> {
  const apiKey = MAPPLS_API_KEY();
  if (!apiKey) {
    console.warn("[mappls] MAPPLS_API_KEY not set — route unavailable");
    return [];
  }

  const origin = `${originLng},${originLat}`;
  const dest   = `${destLng},${destLat}`;

  const url =
    `${MAPPLS_BASE}/api/direction/v2/json` +
    `?origin=${origin}` +
    `&destination=${dest}` +
    `&resource=route_adv` +
    `&geometries=geojson` +
    `&overview=full` +
    `&alternatives=true` +
    `&access_token=${apiKey}`;

  const data = await mapplsFetch<MapplsDirectionsResponse>(url);
  const routes = data?.routes ?? [];

  if (routes.length === 0) {
    console.warn(`[mappls] No route returned for ${origin} -> ${dest}`);
    return [];
  }

  return routes.map((route) => ({
    distanceKm:      Math.round((route.distance ?? 0) / 1000),
    durationMinutes: Math.round((route.duration ?? 0) / 60),
    geometry:        route.geometry?.coordinates ?? [],
  }));
}

/**
 * Convenience: fetches route using coordinates stored on a shipment.
 * Wraps mapplsRoute() with named parameters for clarity.
 */
export async function mapplsRouteByCoords(
  origin: { lat: number; lng: number },
  dest:   { lat: number; lng: number }
): Promise<MapplsRouteResult[]> {
  return mapplsRoute(origin.lng, origin.lat, dest.lng, dest.lat);
}
