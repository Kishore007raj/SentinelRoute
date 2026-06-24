/**
 * traffic-provider.ts — Abstraction layer for traffic data.
 * Supports switching between TomTom, Mappls, or other providers without changing the core engine.
 */

export interface TrafficResult {
  /** Real congestion score 0–100 derived from flow data. -1 = unavailable. */
  trafficScore:    number;
  /** Human-readable incident descriptions to surface as route alerts. */
  incidents:       string[];
  /** True if any incident is a full road closure on this corridor. */
  hasRoadClosure:  boolean;
  /** True if data was successfully fetched (false = fallback values). */
  isLive:          boolean;
}

export interface TrafficProvider {
  /**
   * Fetches real traffic data for the corridor between origin and destination.
   *
   * @param originCoords  [lng, lat] of origin city
   * @param destCoords    [lng, lat] of destination city
   */
  getTrafficData(originCoords: [number, number], destCoords: [number, number]): Promise<TrafficResult>;
}

/**
 * Stub implementation for future Mappls traffic integration.
 */
export class MapplsTrafficProvider implements TrafficProvider {
  async getTrafficData(originCoords: [number, number], destCoords: [number, number]): Promise<TrafficResult> {
    console.warn("[mappls-traffic] Stub called, returning fallback");
    return {
      trafficScore: -1,
      incidents: [],
      hasRoadClosure: false,
      isLive: false,
    };
  }
}
