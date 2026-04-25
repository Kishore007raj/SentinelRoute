/**
 * types.ts — Single source of truth for all types in SentinelRoute.
 *
 * ALL files must import types from here.
 * DO NOT define types anywhere else.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type RiskLevel      = "low" | "medium" | "high" | "critical";
export type ShipmentStatus = "pending" | "active" | "at-risk" | "completed";
export type RouteLabel     = "fastest" | "balanced" | "safest";

// ─── Risk breakdown ───────────────────────────────────────────────────────────

export interface RiskBreakdown {
  traffic:          number;
  weather:          number;
  disruption:       number;
  cargoSensitivity: number;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export interface Route {
  id:           string;
  label:        RouteLabel;
  name:         string;
  /** Human-readable ETA string, e.g. "4h 20m" */
  eta:          string;
  etaMinutes:   number;
  /** Human-readable distance string, e.g. "347 km" */
  distance:     string;
  distanceKm:   number;
  riskScore:    number;
  riskLevel:    RiskLevel;
  recommended:  boolean;
  summary:      string;
  riskBreakdown: RiskBreakdown;
  alerts:       string[];
  /** Encoded polyline from Google Maps Routes API */
  polyline?:    string;
  /** AI-generated explanation from Gemini */
  aiExplanation?: string;
}

// ─── Shipment ─────────────────────────────────────────────────────────────────

export interface Shipment {
  /** Firestore document ID */
  id:                string;
  shipmentCode:      string;
  origin:            string;
  destination:       string;
  /** Route label selected at dispatch */
  selectedRoute:     RouteLabel;
  routeName:         string;
  riskScore:         number;
  riskLevel:         RiskLevel;
  /** Human-readable ETA string, e.g. "5h 05m" */
  eta:               string;
  status:            ShipmentStatus;
  /** Human-readable last update, e.g. "12 min ago" */
  lastUpdate:        string;
  cargoType:         string;
  vehicleType:       string;
  /** Human-readable distance string, e.g. "362 km" */
  distance:          string;
  departureTime:     string;
  confidencePercent: number;
  predictiveAlert?:  string;
  /** Firebase UID of the owner */
  userId?:           string;
  createdAt?:        string;
  updatedAt?:        string;
}

// ─── Pending shipment (form state before dispatch) ────────────────────────────

export interface PendingShipment {
  origin:        string;
  destination:   string;
  vehicleType:   string;
  cargoType:     string;
  urgency:       string;
  deadline?:     string;
  insurance?:    string;
  tempSensitive?: string;
}

// ─── API shapes ───────────────────────────────────────────────────────────────

/** POST /api/analyze-routes — request */
export interface AnalyzeRoutesRequest {
  origin:      string;
  destination: string;
  cargoType:   string;
  vehicleType: string;
  urgency:     string;
}

/** POST /api/analyze-routes — response */
export interface AnalyzeRoutesResponse {
  routes:      Route[];
  analyzedAt:  string;
  source?:     string;
  weatherScore?: number;
}

/** POST /api/shipments — request */
export interface CreateShipmentRequest {
  origin:            string;
  destination:       string;
  vehicleType:       string;
  cargoType:         string;
  urgency:           string;
  routeId:           string;
  routeName:         string;
  riskScore:         number;
  riskLevel:         RiskLevel;
  eta:               string;
  distance:          string;
  confidencePercent: number;
  predictiveAlert?:  string;
}

// ─── Analytics / KPI ─────────────────────────────────────────────────────────

export interface KPI {
  label:         string;
  value:         string;
  delta:         string;
  deltaPositive: boolean;
}
