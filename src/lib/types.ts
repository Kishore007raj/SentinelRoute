/**
 * types.ts — Single source of truth for all shared types.
 *
 * Import from here everywhere. Do NOT import types from mock-data.ts.
 */

// ─── Risk & Status enums ──────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ShipmentStatus = "active" | "at-risk" | "completed" | "pending";
export type RouteLabel = "fastest" | "balanced" | "safest";

// ─── Route ────────────────────────────────────────────────────────────────────

export interface RiskBreakdown {
  traffic: number;
  weather: number;
  disruption: number;
  cargoSensitivity: number;
}

export interface Route {
  id: string;
  label: RouteLabel;
  name: string;
  eta: string;
  etaMinutes: number;
  distance: string;
  distanceKm: number;
  riskScore: number;
  riskLevel: RiskLevel;
  recommended: boolean;
  summary: string;
  riskBreakdown: RiskBreakdown;
  alerts: string[];
  /** Encoded polyline from Google Maps Routes API — used for map rendering */
  polyline?: string;
  /** AI-generated explanation from Gemini — populated after route selection */
  aiExplanation?: string;
}

// ─── Shipment ─────────────────────────────────────────────────────────────────

export interface Shipment {
  id: string;
  shipmentCode: string;
  origin: string;
  destination: string;
  selectedRoute: RouteLabel;
  routeName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  eta: string;
  status: ShipmentStatus;
  lastUpdate: string;
  cargoType: string;
  vehicleType: string;
  distance: string;
  departureTime: string;
  confidencePercent: number;
  predictiveAlert?: string;
  // Added in Layer 3 (Firestore)
  userId?: string;
  createdAt?: string;
}

// ─── Pending shipment (form state before dispatch) ────────────────────────────

export interface PendingShipment {
  origin: string;
  destination: string;
  vehicleType: string;
  cargoType: string;
  urgency: string;
  deadline?: string;
  insurance?: string;
  tempSensitive?: string;
}

// ─── API request / response shapes ───────────────────────────────────────────

/** POST /api/analyze-routes — request body */
export interface AnalyzeRoutesRequest {
  origin: string;
  destination: string;
  cargoType: string;
  vehicleType: string;
  urgency: string;
}

/** POST /api/analyze-routes — response body */
export interface AnalyzeRoutesResponse {
  routes: Route[];
  analyzedAt: string;
}

/** POST /api/shipments — request body */
export interface CreateShipmentRequest {
  origin: string;
  destination: string;
  vehicleType: string;
  cargoType: string;
  urgency: string;
  routeId: string;
  routeName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  eta: string;
  distance: string;
  confidencePercent: number;
  predictiveAlert?: string;
}

// ─── KPI (analytics) ─────────────────────────────────────────────────────────

export interface KPI {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
}
