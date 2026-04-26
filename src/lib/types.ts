/**
 * types.ts — Single source of truth for all types in SentinelRoute.
 * ALL files must import types from here.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type RiskLevel      = "low" | "medium" | "high" | "critical";
/** "pending" is intentionally excluded — all dispatched shipments start as "active" */
export type ShipmentStatus = "active" | "at-risk" | "completed";
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
  id:            string;
  label:         RouteLabel;
  name:          string;
  eta:           string;
  etaMinutes:    number;
  distance:      string;
  distanceKm:    number;
  riskScore:     number;
  riskLevel:     RiskLevel;
  recommended:   boolean;
  summary:       string;
  riskBreakdown: RiskBreakdown;
  alerts:        string[];
  polyline?:     string;
  aiExplanation?: string;
  /**
   * True when this route is a synthesized estimate (balanced/safest from OSRM,
   * or any route from the static fallback). False only for the live OSRM fastest route.
   */
  isSimulated?:  boolean;
  /**
   * SHA-256 hash of the route decision data for integrity verification.
   * Used to detect tampering of route recommendations.
   */
  decisionHash?: string;
}

// ─── Shipment ─────────────────────────────────────────────────────────────────

export interface Shipment {
  id:                string;
  shipmentCode:      string;
  origin:            string;
  destination:       string;
  selectedRoute:     RouteLabel;
  routeName:         string;
  riskScore:         number;
  riskLevel:         RiskLevel;
  eta:               string;
  status:            ShipmentStatus;
  lastUpdate:        string;
  cargoType:         string;
  vehicleType:       string;
  distance:          string;
  departureTime:     string;
  confidencePercent: number;
  predictiveAlert?:  string;
  /** Full breakdown stored at dispatch time — never reconstructed */
  riskBreakdown?:    RiskBreakdown;
  userId?:           string;
  createdAt?:        string;
  updatedAt?:        string;
}

// ─── Pending shipment (form state before dispatch) ────────────────────────────

export interface PendingShipment {
  origin:         string;
  destination:    string;
  vehicleType:    string;
  cargoType:      string;
  urgency:        string;
  deadline?:      string;
  insurance?:     string;
  tempSensitive?: string;
}

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface AnalyzeRoutesRequest {
  origin:      string;
  destination: string;
  cargoType:   string;
  vehicleType: string;
  urgency:     string;
}

export interface AnalyzeRoutesResponse {
  routes:       Route[];
  analyzedAt:   string;
  source?:      string;
  weatherScore?: number;
}

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
  /** Full breakdown from the route analysis — stored on the shipment */
  riskBreakdown?:    RiskBreakdown;
}

// ─── User Settings ────────────────────────────────────────────────────────────

export interface UserSettings {
  userId:                  string;
  // Notifications
  notifyRiskAlerts:        boolean;
  notifyDispatchConfirm:   boolean;
  notifyDisruptions:       boolean;
  notifyCompletionSummary: boolean;
  notifyWeatherWarnings:   boolean;
  notifyAnalyticsDigest:   boolean;
  // Risk thresholds
  autoFlagThreshold:       number;
  requireApprovalAbove:    number;
  autoBlockThreshold:      number;
  preferredRouteType:      RouteLabel;
  // Dispatch defaults
  defaultVehicleType:      string;
  dispatchConfirmWindow:   number;
  updatedAt:               string;
}

export const DEFAULT_SETTINGS: Omit<UserSettings, "userId" | "updatedAt"> = {
  notifyRiskAlerts:        true,
  notifyDispatchConfirm:   true,
  notifyDisruptions:       true,
  notifyCompletionSummary: false,
  notifyWeatherWarnings:   true,
  notifyAnalyticsDigest:   false,
  autoFlagThreshold:       60,
  requireApprovalAbove:    75,
  autoBlockThreshold:      90,
  preferredRouteType:      "balanced",
  defaultVehicleType:      "Container Truck",
  dispatchConfirmWindow:   30,
};

// ─── KPI ─────────────────────────────────────────────────────────────────────

export interface KPI {
  label:         string;
  value:         string;
  delta:         string;
  deltaPositive: boolean;
}
