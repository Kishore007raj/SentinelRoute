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
   * GeoJSON LineString coordinates [lat, lng][] from OSRM.
   * Used to draw the actual road path on the map.
   */
  geometry?:     [number, number][];
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
  /** OSRM road geometry [lat, lng][] stored at dispatch — used for map rendering */
  geometry?:         [number, number][];
  userId?:           string;
  /** Tenant isolation — set at creation from authenticated user's company */
  companyId?:        string;
  /** Ownership — set at creation from authenticated user's uid */
  createdByUserId?:  string;
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

// ─── Company (Module 1) ───────────────────────────────────────────────────────

export type CompanyStatus = "pending" | "approved" | "rejected" | "suspended";
export type UserRole =
  | "company_admin"
  | "operations_manager"
  | "fleet_manager"
  | "dispatcher"
  | "driver"
  | "super_admin";

export type DocumentType =
  | "gst"
  | "pan"
  | "insurance"
  | "transport_license"
  | "fleet_insurance";

export interface Company {
  companyId:           string;
  companyName:         string;
  companyType:         string;
  gstNumber:           string;
  panNumber:           string;
  website:             string;
  email:               string;
  phone:               string;
  address:             string;
  fleetSize:           number;
  operatingStates:     string[];
  cargoCategories:     string[];
  status:              CompanyStatus;
  // ─── Trust metrics (Task 1) — updated by shipment audits; never manually set ──
  trustScore:          number;   // default 100 (starts full, degrades on incidents)
  completedShipments:  number;   // default 0
  delayedShipments:    number;   // default 0
  incidentCount:       number;   // default 0
  auditFlags:          number;   // default 0
  // ─────────────────────────────────────────────────────────────────────────────
  createdAt:           string;
  approvedAt?:         string;
  approvedBy?:         string;
}

export interface UserRecord {
  userId:    string;
  companyId: string;
  name:      string;
  email:     string;
  role:      UserRole;
  active:    boolean;
  createdAt: string;
}

export interface CompanyDocument {
  documentId:  string;
  companyId:   string;
  type:        DocumentType;
  fileUrl:     string;
  uploadedAt:  string;
  verified:    boolean;
}

export interface CompanyAudit {
  auditId:     string;
  companyId:   string;
  eventType:   string;
  description: string;
  actorId:     string;
  timestamp:   string;
}

// ─── Company Settings (Task 2 — Module 1 Finalization) ────────────────────────

export interface CompanySettings {
  companyId:           string;
  language:            string;   // default "en"
  timezone:            string;   // default "Asia/Kolkata"
  riskThreshold:       number;   // default 60
  autoApprovalEnabled: boolean;  // default false
  createdAt:           string;
  updatedAt:           string;
}

export const DEFAULT_COMPANY_SETTINGS: Omit<CompanySettings, "companyId" | "createdAt" | "updatedAt"> = {
  language:            "en",
  timezone:            "Asia/Kolkata",
  riskThreshold:       60,
  autoApprovalEnabled: false,
};

// ─── Audit event types (Task 3 — Module 1 Finalization) ──────────────────────

export type AuditEventType =
  | "company_registered"
  | "document_uploaded"
  | "verification_submitted"
  | "company_approved"
  | "company_rejected"
  | "company_suspended"
  | "company_reactivated"
  | "shipment_created"
  | "shipment_completed"
  | "shipment_delayed"
  | "shipment_incident";

// ─── Module 2 placeholder types (Task 7) ─────────────────────────────────────
// These are type definitions ONLY. No pages or APIs are created for these yet.

export interface Driver {
  driverId:     string;
  companyId:    string;
  userId:       string;
  name:         string;
  licenseNumber: string;
  phone:        string;
  active:       boolean;
  createdAt:    string;
}

export interface Vehicle {
  vehicleId:      string;
  companyId:      string;
  registrationNo: string;
  vehicleType:    string;
  capacity:       string;
  active:         boolean;
  assignedDriver?: string;
  createdAt:      string;
}

export interface FleetManager {
  managerId:  string;
  companyId:  string;
  userId:     string;
  name:       string;
  email:      string;
  active:     boolean;
  createdAt:  string;
}

export interface Dispatcher {
  dispatcherId: string;
  companyId:    string;
  userId:       string;
  name:         string;
  email:        string;
  active:       boolean;
  createdAt:    string;
}

export interface OperationsManager {
  operationsManagerId: string;
  companyId:           string;
  userId:              string;
  name:                string;
  email:               string;
  active:              boolean;
  createdAt:           string;
}
