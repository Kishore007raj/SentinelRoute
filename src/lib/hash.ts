/**
 * hash.ts — SHA-256 integrity hashing for route decisions.
 *
 * Creates cryptographic hashes of route analysis decisions to detect tampering.
 * Used to verify that route recommendations haven't been modified after generation.
 *
 * Hash input includes:
 *   - Route coordinates and waypoints
 *   - Risk score and factors
 *   - Weather conditions at analysis time
 *   - Timestamp of analysis
 */

import { createHash } from "crypto";

/**
 * Waypoint data structure for route hashing.
 */
export interface Waypoint {
  lat?: number;
  lng?: number;
  name?: string;
  [key: string]: unknown;
}

/**
 * Route decision data structure for hashing.
 * Contains all critical data that affects route recommendations.
 */
export interface RouteDecisionData {
  route: {
    id?: string;
    label?: string;
    coordinates?: number[][];
    waypoints?: Waypoint[];
    distanceKm?: number;
    etaMinutes?: number;
    riskBreakdown?: {
      traffic?: number;
      weather?: number;
      disruption?: number;
      cargoSensitivity?: number;
    };
    [key: string]: unknown;
  };
  riskScore: number;
  riskFactors?: string[];
  weather?: number | {
    conditions?: string;
    temperature?: number;
    visibility?: number;
    [key: string]: unknown;
  };
  timestamp?: string | number;
  [key: string]: unknown;
}

/**
 * Creates a SHA-256 hash of route decision data.
 * 
 * The hash is deterministic - same input always produces same hash.
 * Used to verify route integrity and detect unauthorized modifications.
 * 
 * @param data - Route decision data to hash
 * @returns SHA-256 hash as hexadecimal string
 */
export function createDecisionHash(data: RouteDecisionData): string {
  // Normalize the data for consistent hashing
  const normalized = normalizeForHashing(data);
  
  // Convert to canonical JSON string (sorted keys, no whitespace)
  const jsonString = JSON.stringify(normalized, Object.keys(normalized).sort());
  
  // Create SHA-256 hash
  const hash = createHash("sha256");
  hash.update(jsonString, "utf8");
  
  return hash.digest("hex");
}

/**
 * Verifies that route decision data matches the provided hash.
 * 
 * @param data - Route decision data to verify
 * @param expectedHash - Expected SHA-256 hash
 * @returns true if data matches hash, false if tampered or corrupted
 */
export function verifyDecisionHash(data: RouteDecisionData, expectedHash: string): boolean {
  if (!expectedHash || typeof expectedHash !== "string") {
    return false;
  }
  
  try {
    const actualHash = createDecisionHash(data);
    return actualHash === expectedHash.toLowerCase();
  } catch (err) {
    console.error("[hash] Failed to verify decision hash:", err);
    return false;
  }
}

/**
 * Normalizes route decision data for consistent hashing.
 * Removes non-deterministic fields and standardizes formats.
 */
function normalizeForHashing(data: RouteDecisionData): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  
  // Include route data (coordinates, distance, duration)
  if (data.route) {
    normalized.route = {
      id: data.route.id || "",
      label: data.route.label || "",
      coordinates: data.route.coordinates || [],
      waypoints: data.route.waypoints || [],
      distanceKm: data.route.distanceKm || 0,
      etaMinutes: data.route.etaMinutes || 0,
      riskBreakdown: data.route.riskBreakdown || {}
    };
  }
  
  // Include risk assessment
  normalized.riskScore = data.riskScore || 0;
  if (data.riskFactors && Array.isArray(data.riskFactors)) {
    normalized.riskFactors = [...data.riskFactors].sort(); // Sort for consistency
  }
  
  // Include weather conditions (handle both number and object formats)
  if (typeof data.weather === "number") {
    normalized.weather = data.weather;
  } else if (data.weather && typeof data.weather === "object") {
    normalized.weather = {
      conditions: data.weather.conditions || "",
      temperature: data.weather.temperature || 0,
      visibility: data.weather.visibility || 0
    };
  } else {
    normalized.weather = 0;
  }
  
  // Include timestamp (convert to ISO string for consistency)
  if (data.timestamp) {
    if (typeof data.timestamp === "number") {
      normalized.timestamp = new Date(data.timestamp).toISOString();
    } else {
      normalized.timestamp = new Date(data.timestamp).toISOString();
    }
  } else {
    // Use current time if no timestamp provided
    normalized.timestamp = new Date().toISOString();
  }
  
  return normalized;
}

/**
 * Creates a hash for route analysis results including metadata.
 * Convenience function for API routes that need to hash complete analysis.
 * 
 * @param analysis - Complete route analysis result
 * @returns Object with original analysis plus decisionHash
 */
export function hashRouteAnalysis<T extends RouteDecisionData>(analysis: T): T & { decisionHash: string } {
  const hash = createDecisionHash(analysis);
  
  return {
    ...analysis,
    decisionHash: hash
  };
}

/**
 * Verifies a route analysis result against its embedded hash.
 * 
 * @param analysis - Route analysis with embedded decisionHash
 * @returns true if analysis is verified, false if tampered
 */
export function verifyRouteAnalysis(analysis: RouteDecisionData & { decisionHash?: string }): boolean {
  if (!analysis.decisionHash) {
    return false;
  }
  
  // Extract hash and verify against remaining data
  const { decisionHash, ...dataToVerify } = analysis;
  return verifyDecisionHash(dataToVerify, decisionHash);
}