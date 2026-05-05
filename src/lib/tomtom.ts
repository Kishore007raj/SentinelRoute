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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TomTomTrafficResult {
  /** Real congestion score 0–100 derived from flow data. -1 = unavailable. */
  trafficScore:    number;
  /** Human-readable incident descriptions to surface as route alerts. */
  incidents:       string[];
  /** True if any incident is a full road closure on this corridor. */
  hasRoadClosure:  boolean;
  /** True if TomTom data was successfully fetched (false = fallback values). */
  isLive:          boolean;
}

/** Safe fallback returned when TomTom is unavailable. */
const FALLBACK: TomTomTrafficResult = {
  trafficScore:   -1,
  incidents:      [],
  hasRoadClosure: false,
  isLive:         false,
};

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
): Promise<{ incidents: string[]; hasRoadClosure: boolean }> {
  // Try v5 first, fall back to v4 if 401 (key scope issue)
  const v5url =
    `https://api.tomtom.com/traffic/services/5/incidentDetails` +
    `?key=${apiKey}` +
    `&bbox=${bbox}` +
    `&fields={incidents{type,properties{iconCategory,magnitudeOfDelay,events{description}}}}` +
    `&language=en-GB` +
    `&timeValidityFilter=present`;

  let res = await fetch(v5url, { signal });

  // v5 returned 401 — try v4 which uses a simpler request format
  if (res.status === 401) {
    console.warn("[tomtom] Incidents v5 returned 401 — trying v4");
    const v4url =
      `https://api.tomtom.com/traffic/services/4/incidentDetails/s3/${bbox}/10/-1` +
      `?key=${apiKey}` +
      `&projection=EPSG4326` +
      `&expandCluster=true`;
    res = await fetch(v4url, { signal });
  }

  if (!res.ok) {
    console.warn(`[tomtom] Incidents API error ${res.status}`);
    return { incidents: [], hasRoadClosure: false };
  }

  // v4 and v5 have different response shapes — handle both
  const data = await res.json() as Record<string, unknown>;

  // v5 shape: { incidents: [...] }
  // v4 shape: { tm: { poi: [...] } }
  let rawIncidents: TomTomIncident[] = [];
  if (Array.isArray((data as TomTomIncidentsResponse).incidents)) {
    rawIncidents = (data as TomTomIncidentsResponse).incidents ?? [];
  } else if (data.tm && typeof data.tm === "object") {
    // v4: extract poi array and map to v5-like shape
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
  }

  const raw = rawIncidents;

  const incidents: string[] = [];
  let hasRoadClosure = false;

  for (const incident of raw) {
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
): Promise<number> {
  // Sample at the midpoint of the corridor
  const midLat = (originCoords[1] + destCoords[1]) / 2;
  const midLon = (originCoords[0] + destCoords[0]) / 2;

  const url =
    `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
    `?key=${apiKey}` +
    `&point=${midLat},${midLon}` +
    `&unit=KMPH`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    console.warn(`[tomtom] Flow API error ${res.status} for point (${midLat.toFixed(3)},${midLon.toFixed(3)})`);
    return -1;
  }

  const data: TomTomFlowResponse = await res.json();
  const flow = data.flowSegmentData;
  if (!flow?.currentSpeed || !flow?.freeFlowSpeed || flow.freeFlowSpeed === 0) {
    return -1;
  }

  const ratio = flow.currentSpeed / flow.freeFlowSpeed;
  // Convert ratio to a 0–100 congestion score (inverted — lower speed = higher score)
  const score = Math.round(Math.max(0, Math.min(100, (1 - ratio) * 110)));
  console.log(
    `[tomtom] Flow at (${midLat.toFixed(3)},${midLon.toFixed(3)}): ` +
    `${flow.currentSpeed}/${flow.freeFlowSpeed} km/h → score ${score}`
  );
  return score;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches real traffic data for the corridor between origin and destination.
 *
 * Runs incidents + flow in parallel with a shared 10s AbortController.
 * Returns FALLBACK on any error — callers must handle isLive: false.
 *
 * @param originCoords  [lng, lat] of origin city
 * @param destCoords    [lng, lat] of destination city
 */
export async function getTomTomTrafficData(
  originCoords: [number, number],
  destCoords:   [number, number]
): Promise<TomTomTrafficResult> {
  const apiKey = process.env.TRAFFIC_API_KEY;
  if (!apiKey) {
    console.warn("[tomtom] TRAFFIC_API_KEY not set — skipping live traffic");
    return FALLBACK;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const bbox = buildBbox(originCoords, destCoords);

    const [incidentResult, flowScore] = await Promise.all([
      fetchIncidents(bbox, apiKey, controller.signal),
      fetchFlowScore(originCoords, destCoords, apiKey, controller.signal),
    ]);

    clearTimeout(timer);

    // Only mark as live if flow data was actually retrieved
    // Incidents alone without a flow score is not sufficient for risk scoring
    const isLive = flowScore >= 0;

    if (isLive) {
      console.log(
        `[tomtom] Live data: score=${flowScore} incidents=${incidentResult.incidents.length} closure=${incidentResult.hasRoadClosure}`
      );
    } else {
      console.warn("[tomtom] Flow score unavailable — falling back to OSRM estimate");
    }

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
