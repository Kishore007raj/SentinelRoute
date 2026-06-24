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
  // Multilingual
  /** Notification and UI language for this user. Default: "en" */
  language:                string;
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
  language:                "en",
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
  | "super_admin"
  | "company_manager"
  | "operations_manager"
  | "fleet_manager"
  | "dispatcher"
  | "driver";

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
  // ─── Trust metrics ────────────────────────────────────────────────────────
  trustScore:          number;
  completedShipments:  number;
  delayedShipments:    number;
  incidentCount:       number;
  auditFlags:          number;
  // ─── Multilingual (Multilingual Foundation) ───────────────────────────────
  /** Default language for the company workspace. Default: "en" */
  preferredLanguage:   string;
  /** Languages allowed for company users. Default: ["en"] */
  supportedLanguages:  string[];
  /** Fallback language when preferred is unavailable. Default: "en" */
  fallbackLanguage:    string;
  // ─────────────────────────────────────────────────────────────────────────
  createdAt:           string;
  approvedAt?:         string;
  approvedBy?:         string;
  submittedAt?:        string;
}

export interface UserRecord {
  userId:            string;
  companyId:         string;
  name:              string;
  email:             string;
  role:              UserRole;
  active:            boolean;
  /** User's preferred display language. Falls back to company preferredLanguage. */
  preferredLanguage?: string;
  createdAt:         string;
}

export interface CompanyDocument {
  documentId:  string;
  companyId:   string;
  type:        DocumentType;
  fileName:    string;   // original filename
  mimeType:    string;   // e.g. "application/pdf"
  fileSize:    number;   // size in bytes
  fileData:    string;   // Base64-encoded file content
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
  companyId:            string;
  // ─── Multilingual ──────────────────────────────────────────────────────────
  language:             string;    // default "en" — company workspace default language
  supportedLanguages:   string[];  // languages enabled for this company's users
  fallbackLanguage:     string;    // default "en"
  // ─── Operations ────────────────────────────────────────────────────────────
  timezone:             string;    // default "Asia/Kolkata"
  riskThreshold:        number;    // default 60
  autoApprovalEnabled:  boolean;   // default false
  createdAt:            string;
  updatedAt:            string;
}

export const DEFAULT_COMPANY_SETTINGS: Omit<CompanySettings, "companyId" | "createdAt" | "updatedAt"> = {
  language:            "en",
  supportedLanguages:  ["en"],
  fallbackLanguage:    "en",
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

// ─── Module 2 — Workforce Management types ───────────────────────────────────

export interface Driver {
  // ─── Identity ─────────────────────────────────────────────────────────────
  driverId:                string;      // "drv-<timestamp>-<random4>"
  companyId:               string;      // tenant key — indexed
  employeeId:              string;      // company-assigned employee number
  fullName:                string;
  phone:                   string;
  email:                   string;

  // ─── Licence ──────────────────────────────────────────────────────────────
  licenseNumber:           string;
  licenseExpiry:           string;      // ISO date string "YYYY-MM-DD"

  // ─── Personal ─────────────────────────────────────────────────────────────
  aadhaarNumber:           string;      // encrypted at rest (AES-256)
  bloodGroup:              string;
  address:                 string;

  // ─── Status ───────────────────────────────────────────────────────────────
  status:                  "active" | "inactive" | "suspended";
  assignedVehicleId:       string | null;

  // ─── Module 3/4/5 Future Fields ───────────────────────────────────────────
  shipmentIds:             string[];    // default [] — Module 3 linkage
  communicationChannelId:  string | null; // default null — Module 3 comm layer
  /** Driver's primary display/communication language. Default: "en" */
  preferredLanguage:       string;
  /** Additional languages the driver understands. Default: [] */
  languagePreferences:     string[];

  // ─── Timestamps ───────────────────────────────────────────────────────────
  createdAt:               string;      // UTC ISO
  updatedAt:               string;      // UTC ISO
}

export interface Vehicle {
  // ─── Identity ─────────────────────────────────────────────────────────────
  vehicleId:               string;      // "veh-<timestamp>-<random4>"
  companyId:               string;      // indexed

  // ─── Registration ─────────────────────────────────────────────────────────
  vehicleNumber:           string;      // e.g. "MH12AB1234"
  vehicleType:             string;      // e.g. "Container Truck"
  capacity:                string;      // e.g. "10 tonnes"
  fuelType:                string;

  // ─── Documents ────────────────────────────────────────────────────────────
  insuranceNumber:         string;
  insuranceExpiry:         string;      // ISO date
  fitnessExpiry:           string;      // ISO date
  permitExpiry:            string;      // ISO date

  // ─── Status ───────────────────────────────────────────────────────────────
  status:                  "available" | "assigned" | "maintenance" | "inactive";
  currentDriverId:         string | null;

  // ─── Module 3/4 Future Fields ─────────────────────────────────────────────
  shipmentIds:             string[];    // default [] — Module 3 linkage
  trackingDeviceId:        string | null; // default null — Module 4 Mappls

  // ─── Timestamps ───────────────────────────────────────────────────────────
  createdAt:               string;
  updatedAt:               string;
}

export interface CompanyUser {
  companyId:   string;
  userId:      string;
  role:        UserRole;
  active:      boolean;
  createdAt:   string;
  updatedAt:   string;
}

export type WorkforceEventType =
  | "driver_created"
  | "driver_updated"
  | "driver_suspended"
  | "driver_activated"
  | "vehicle_added"
  | "vehicle_updated"
  | "vehicle_assigned"
  | "vehicle_unassigned"
  | "vehicle_maintenance"
  | "vehicle_activated"
  | "vehicle_deactivated"
  | "user_invited"
  | "user_disabled"
  | "user_activated"
  | "user_role_changed"
  | "super_admin_read";

export interface WorkforceAudit {
  auditId:     string;       // "waudit-<timestamp>-<random5>"
  companyId:   string;
  eventType:   WorkforceEventType;
  actorId:     string;
  targetId:    string;
  targetType:  "driver" | "vehicle" | "user";
  details:     Record<string, unknown>;
  timestamp:   string;       // UTC ISO — immutable, never updated
}

// ─── Module 3 — Operational Intelligence Platform ─────────────────────────────

export type IncidentCategory = "Weather" | "Traffic" | "Road Closure" | "Accident" | "Construction" | "Political" | "Public Event" | "Natural Disaster" | "Restriction" | "Unknown";

export interface Incident {
  incidentId:         string;
  companyId?:         string; // Optional, some incidents might be company specific but usually global
  title:              string;
  description:        string;
  category:           IncidentCategory;
  severity:           "low" | "medium" | "high" | "critical";
  confidence:         number;
  latitude:           number;
  longitude:          number;
  affectedRadiusKm:   number;
  startTime:          string;
  lastUpdated:        string;
  expectedEndTime?:   string;
  source:             string;
  verifiedStatus:     boolean;
  impactScore:        number;
  recommendedAction:  string;
}

export interface RoutePrediction {
  predictionId:               string;
  shipmentId:                 string;
  companyId:                  string;
  timestamp:                  string;
  createdAt?:                 string;
  delayProbability:           number; // 0-100
  disruptionProbability:      number; // 0-100
  etaConfidence:              number; // 0-100
  corridorVolatility:         number; // 0-100
  weatherConfidence:          number; // 0-100
  incidentDensity:            number; // 0-100
  trafficStability:           number; // 0-100
  historicalCorridorReliability: number; // 0-100
  riskTrend:                  "improving" | "stable" | "degrading";
  expectedDelayMinutes:       number;
  recommendedRouteConfidence: number; // 0-100
  overallOperationalConfidence: number; // 0-100
  reason:                     string;
  contributingFactors:        string[];
  weight?:                    number;
  sourceApis?:                string[];
}

export type TimelineEventType =
  | "Shipment Created"
  | "Route Selected"
  | "Dispatch Started"
  | "Weather Changed"
  | "Traffic Increased"
  | "Incident Detected"
  | "Risk Increased"
  | "Risk Reduced"
  | "ETA Updated"
  | "Driver Message"
  | "Dispatcher Message"
  | "System Alert"
  | "Suggested Reroute"
  | "Route Changed"
  | "Shipment Completed";

export interface ShipmentTimelineEvent {
  eventId:          string;
  shipmentId:       string;
  companyId:        string;
  timestamp:        string; // ISO timestamp
  type:             TimelineEventType;
  description:      string;
  source:           string;
  confidence:       number;
  affectedMetrics?: string[];
}

export interface CorridorStatistic {
  corridorId:            string;
  companyId?:            string; // Mostly global, but keep tenant-scoped for isolated intelligence? Spec says "Every logistics corridor receives intelligence. Example Chennai -> Bengaluru"
  origin:                string;
  destination:           string;
  averageDelay:          number; // minutes
  riskHistory:           number[]; // Historical scores
  weatherTrend:          "clear" | "rainy" | "stormy" | "foggy";
  incidentDensity:       number; // 0-100
  roadQuality:           number; // 0-100
  averageEtaVariance:    number; // minutes
  historicalReliability: number; // 0-100
  currentOperationalStatus: "optimal" | "warning" | "disrupted";
  confidence:            number; // 0-100
}

export interface ShipmentChannel {
  channelId:   string;
  shipmentId:  string;
  companyId:   string;
  active:      boolean;
  createdAt:   string;
  updatedAt:   string;
}

export type MessageType = "text" | "system" | "image" | "pdf";
export type MessageSenderRole = "Dispatcher" | "Driver" | "Operations Manager" | "System";

export interface ShipmentMessage {
  messageId:   string;
  channelId:   string;
  shipmentId:  string;
  companyId:   string;
  senderType:  MessageSenderRole;
  senderId?:   string; // userId or driverId
  senderName:  string;
  messageType: MessageType;
  message:     string;
  fileUrl?:    string; // for image/pdf
  timestamp:   string;
  readStatus:  boolean;
}

export interface OperationalAlert {
  alertId:           string;
  shipmentId?:       string;
  companyId:         string;
  reason:            string;
  confidence:        number;
  timestamp:         string;
  recommendedAction: string;
  status?:           string;
  severity?:         string;
}
