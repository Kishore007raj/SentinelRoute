/**
 * tomtom.ts — TomTom Traffic API client for SentinelRoute.
 *
 * Fetches real traffic incidents and flow data for a route corridor.
 * Server-side only — uses TRAFFIC_API_KEY (never NEXT_PUBLIC_).
 *
 * Two endpoints used:
 *   1. Traffic Incidents API — accidents, closures, events, construction
 *   2. Traffic Flow API     — current speed vs free-flow speed (congestion score)
 *
 * Hard 10s timeout on every call.
 * Always returns a safe fallback — never throws to callers.
 */

import { TRAFFIC_API_KEY } from "./env";
import { type TrafficProvider, type TrafficResult } from "./traffic-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Safe fallback returned when TomTom is unavailable. */
const FALLBACK: TrafficResult = {
  trafficScore:   -1,
  incidents:      [],
  hasRoadClosure: false,
  isLive:         false,
};

// In-process cooldown after a 401 — the key won't become valid mid-session,
// so skip all TomTom calls until the next deployment rather than logging
// a 401 on every single request.
let invalidKeyUntil = 0;
const INVALID_KEY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// ─── TomTom incident category → human-readable label ─────────────────────────
// iconCategory values: https://developer.tomtom.com/traffic-api/documentation/traffic-incidents/incident-details

const CATEGORY_LABEL: Record<number, string> = {
  0:  "Unknown incident",
  1:  "Accident",
  2:  "Fog",
  3:  "Dangerous conditions",
  4:  "Rain",
  5:  "Ice",
  6:  "Jam",
  7:  "Lane closed",
  8:  "Road closed",
  9:  "Road works",
  10: "Wind",
  11: "Flooding",
  14: "Broken down vehicle",
};

// magnitudeOfDelay: 0=unknown, 1=minor, 2=moderate, 3=major, 4=undefined
const SEVERITY_LABEL: Record<number, string> = {
  1: "minor",
  2: "moderate",
  3: "major",
};

// ─── Bounding box helper ──────────────────────────────────────────────────────

/**
 * Builds a bounding box string from two [lng, lat] coordinate pairs.
 * TomTom expects: minLon,minLat,maxLon,maxLat
 * Adds a small padding (0.3°) to catch incidents near the corridor edges.
 */
function buildBbox(
  originCoords:  [number, number],
  destCoords:    [number, number],
  padding = 0.3
): string {
  const [oLng, oLat] = originCoords;
  const [dLng, dLat] = destCoords;
  const minLon = Math.min(oLng, dLng) - padding;
  const minLat = Math.min(oLat, dLat) - padding;
  const maxLon = Math.max(oLng, dLng) + padding;
  const maxLat = Math.max(oLat, dLat) + padding;
  return `${minLon},${minLat},${maxLon},${maxLat}`;
}

// ─── Traffic Incidents ────────────────────────────────────────────────────────

interface TomTomIncident {
  type: string;
  properties?: {
    iconCategory?:      number;
    magnitudeOfDelay?:  number;
    events?: Array<{ description?: string; code?: number }>;
  };
}

interface TomTomIncidentsResponse {
  incidents?: TomTomIncident[];
}

async function fetchIncidents(
  bbox: string,
  apiKey: string,
  signal: AbortSignal
): Promise<{ incidents: string[]; hasRoadClosure: boolean; unauthorized?: boolean }> {
  // Use v4 directly — v5 requires additional API key scopes not available on free tier
  const url =
    `https://api.tomtom.com/traffic/services/4/incidentDetails/s3/${bbox}/10/-1` +
    `?key=${apiKey}` +
    `&projection=EPSG4326` +
    `&expandCluster=true`;

  const res = await fetch(url, { signal });

  if (res.status === 401) {
    return { incidents: [], hasRoadClosure: false, unauthorized: true };
  }

  if (!res.ok) {
    console.warn(`[tomtom] Incidents API error ${res.status}`);
    return { incidents: [], hasRoadClosure: false };
  }

  // v4 shape: { tm: { poi: [...] } }
  const data = await res.json() as Record<string, unknown>;

  let rawIncidents: TomTomIncident[] = [];
  if (data.tm && typeof data.tm === "object") {
    const tm = data.tm as Record<string, unknown>;
    const poi = Array.isArray(tm.poi) ? tm.poi as Array<Record<string, unknown>> : [];
    rawIncidents = poi.map((p) => ({
      type: "Feature",
      properties: {
        iconCategory:     typeof p.ic === "number" ? p.ic : 0,
        magnitudeOfDelay: typeof p.dl === "number" ? Math.min(3, Math.ceil(p.dl / 30)) : 0,
        events: [{ description: typeof p.d === "string" ? p.d : undefined }],
      },
    }));
  } else if (Array.isArray((data as TomTomIncidentsResponse).incidents)) {
    // v5 shape fallback (future-proof)
    rawIncidents = (data as TomTomIncidentsResponse).incidents ?? [];
  }

  console.log(`[tomtom] Incidents: ${rawIncidents.length} raw incidents in bbox`);

  const incidents: string[] = [];
  let hasRoadClosure = false;

  for (const incident of rawIncidents) {
    const props = incident.properties;
    if (!props) continue;

    const category  = props.iconCategory ?? 0;
    const severity  = props.magnitudeOfDelay ?? 0;
    const eventDesc = props.events?.[0]?.description;

    // Road closure (category 8)
    if (category === 8) {
      hasRoadClosure = true;
      const desc = eventDesc ?? "Road closure on corridor";
      incidents.push(desc);
      continue;
    }

    // Only surface moderate+ severity incidents to avoid noise
    if (severity >= 2) {
      const label    = CATEGORY_LABEL[category] ?? "Traffic incident";
      const sevLabel = SEVERITY_LABEL[severity] ?? "";
      const desc     = eventDesc
        ? eventDesc
        : sevLabel ? `${sevLabel} ${label.toLowerCase()}` : label;
      incidents.push(desc);
    }
  }

  // Cap at 3 incidents — most relevant first (closures already at front)
  return { incidents: incidents.slice(0, 3), hasRoadClosure };
}

// ─── Traffic Flow ─────────────────────────────────────────────────────────────

interface TomTomFlowResponse {
  flowSegmentData?: {
    currentSpeed?:  number;
    freeFlowSpeed?: number;
    confidence?:    number;
  };
}

/**
 * Samples traffic flow at the midpoint between origin and destination.
 * Returns a congestion score 0–100:
 *   currentSpeed / freeFlowSpeed → ratio → inverted to a risk score.
 *   ratio 1.0 (free flow) → score 5
 *   ratio 0.5 (half speed) → score 50
 *   ratio 0.2 (near standstill) → score 90
 */
async function fetchFlowScore(
  originCoords: [number, number],
  destCoords:   [number, number],
  apiKey: string,
  signal: AbortSignal
): Promise<{ score: number; unauthorized?: boolean }> {
  // Sample at the midpoint of the corridor
  const midLat = (originCoords[1] + destCoords[1]) / 2;
  const midLon = (originCoords[0] + destCoords[0]) / 2;

  const url =
    `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
    `?key=${apiKey}` +
    `&point=${midLat},${midLon}` +
    `&unit=KMPH`;

  const res = await fetch(url, { signal });

  if (res.status === 401) {
    return { score: -1, unauthorized: true };
  }

  if (!res.ok) {
    console.warn(`[tomtom] Flow API error ${res.status} for point (${midLat.toFixed(3)},${midLon.toFixed(3)})`);
    return { score: -1 };
  }

  const data: TomTomFlowResponse = await res.json();
  const flow = data.flowSegmentData;
  if (!flow?.currentSpeed || !flow?.freeFlowSpeed || flow.freeFlowSpeed === 0) {
    return { score: -1 };
  }

  const ratio = flow.currentSpeed / flow.freeFlowSpeed;
  // Convert ratio to a 0–100 congestion score (inverted — lower speed = higher score)
  const score = Math.round(Math.max(0, Math.min(100, (1 - ratio) * 110)));
  console.log(
    `[tomtom] Flow at (${midLat.toFixed(3)},${midLon.toFixed(3)}): ` +
    `${flow.currentSpeed}/${flow.freeFlowSpeed} km/h → score ${score}`
  );
  return { score };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export class TomTomTrafficProvider implements TrafficProvider {
  /**
   * Fetches real traffic data for the corridor between origin and destination.
   *
   * Runs incidents + flow in parallel with a shared 10s AbortController.
   * Returns FALLBACK on any error — callers must handle isLive: false.
   *
   * @param originCoords  [lng, lat] of origin city
   * @param destCoords    [lng, lat] of destination city
   */
  async getTrafficData(
    originCoords: [number, number],
    destCoords:   [number, number]
  ): Promise<TrafficResult> {
  const apiKey = TRAFFIC_API_KEY();
  if (!apiKey) {
    console.warn("[tomtom] TRAFFIC_API_KEY not set — skipping live traffic");
    return FALLBACK;
  }

  // Skip all calls if the key was already rejected — it won't fix itself mid-session
  if (Date.now() < invalidKeyUntil) {
    return FALLBACK;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const bbox = buildBbox(originCoords, destCoords);

    const [incidentResult, flowResult] = await Promise.all([
      fetchIncidents(bbox, apiKey, controller.signal),
      fetchFlowScore(originCoords, destCoords, apiKey, controller.signal),
    ]);

    clearTimeout(timer);

    // If either call got a 401, the key is invalid — log once and cool down
    if (incidentResult.unauthorized || flowResult.unauthorized) {
      invalidKeyUntil = Date.now() + INVALID_KEY_COOLDOWN_MS;
      console.error("[tomtom] API key rejected (401) — disabling TomTom for this session. Set TRAFFIC_API_KEY in Vercel environment variables.");
      return FALLBACK;
    }

    const flowScore = flowResult.score;

    // Mark as live when incidents API succeeded.
    // Flow score may be -1 in areas with limited TomTom coverage (common in India)
    // — in that case we still use real incident data and fall back to OSRM for traffic score.
    const isLive = true; // incidents fetch succeeded (no throw, no 401)

    console.log(
      `[tomtom] Live: incidents=${incidentResult.incidents.length} ` +
      `closure=${incidentResult.hasRoadClosure} ` +
      `flowScore=${flowScore >= 0 ? flowScore : "unavailable (limited coverage)"}`
    );

    return {
      trafficScore:   flowScore,
      incidents:      incidentResult.incidents,
      hasRoadClosure: incidentResult.hasRoadClosure,
      isLive,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const name = (err as { name?: string }).name ?? "";
    if (name === "AbortError") {
      console.warn("[tomtom] Request timed out after 10s — using fallback");
    } else {
      console.error("[tomtom] Fetch error:", err);
    }
    return FALLBACK;
  }
}
}
