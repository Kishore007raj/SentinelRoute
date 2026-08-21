/**
 * types.ts - Single source of truth for all types in SentinelRoute.
 * ALL files must import types from here.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type RiskLevel      = "low" | "medium" | "high" | "critical";
export type ShipmentStatus = "draft" | "active" | "at-risk" | "completed" | "cancelled";
export type RouteLabel     = "fastest" | "balanced" | "safest";

// ─── Risk breakdown ───────────────────────────────────────────────────────────

export interface RiskBreakdown {
  traffic:          number;
  weather:          number;
  disruption:       number;
  cargoSensitivity: number;
  // Module 5 requirements
  festival?:        number;
  news?:            number;
  historical?:      number;
  road?:            number;
  operational?:     number;
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
  
  // Module 5 Route Intelligence fields
  averageSpeed?: number;
  trafficDelay?: number;
  weatherSummary?: string;
  roadIncidents?: number;
  confidenceScore?: number;
  predictionConfidence?: number;
  historicalReliability?: number;
  historicalShipments?: number;
  fuelEstimate?: number;
  carbonEstimate?: number;
  expectedDelay?: number;
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
  /** Full breakdown stored at dispatch time - never reconstructed */
  riskBreakdown?:    RiskBreakdown;
  /** Road geometry [lng, lat][] stored at dispatch - used for map rendering */
  geometry?:         [number, number][];
  userId?:           string;
  /** Tenant isolation - set at creation from authenticated user's company */
  companyId?:        string;
  /** Ownership - set at creation from authenticated user's uid */
  createdByUserId?:  string;
  createdAt?:        string;
  updatedAt?:        string;
  // ── Geoapify location data (Phase 3 - coordinate-aware shipments) ──────────
  /** Origin display name from Geoapify autosuggest */
  originName?:            string;
  /** Origin full address string */
  originAddress?:         string;
  /** Origin latitude (WGS84) */
  originLat?:             number;
  /** Origin longitude (WGS84) */
  originLng?:             number;
  /** Geoapify placeId for origin */
  originPlaceId?:         string;
  /** Destination display name from Geoapify autosuggest */
  destinationName?:       string;
  /** Destination full address string */
  destinationAddress?:    string;
  /** Destination latitude (WGS84) */
  destinationLat?:        number;
  /** Destination longitude (WGS84) */
  destinationLng?:        number;
  /** Geoapify placeId for destination */
  destinationPlaceId?:    string;
  // ── Cargo + schedule data (Phase 9 - Module 4 readiness) ─────────────────
  /** Gross cargo weight in kilograms */
  cargoWeightKg?:         number;
  /** Cargo volume in cubic metres */
  cargoVolumeM3?:         number;
  /** ISO-8601 planned departure datetime (UTC) */
  plannedDeparture?:      string;
  /** ISO-8601 planned arrival datetime (UTC) */
  plannedArrival?:        string;
  // ── Module 4 - Workforce assignment ──────────────────────────────────────
  /** Assigned driver ID (from drivers collection) */
  assignedDriverId?:      string;
  /** Driver display name snapshot at assignment time */
  assignedDriverName?:    string;
  /** Assigned vehicle ID (from vehicles collection) */
  assignedVehicleId?:     string;
  /** Vehicle number snapshot at assignment time */
  assignedVehicleNumber?: string;
  /** Insurance type for this shipment */
  insuranceType?:         string;
  /** Temperature requirement */
  temperatureRequirement?: string;
  /** Priority level */
  priority?:              string;
  /** Deadline for delivery (ISO-8601) */
  deadline?:              string;
  /** Current GPS location of the shipment */
  currentLocation?:       { lat: number; lng: number; updatedAt: string };
  /** Reason for cancellation */
  cancellationReason?:    string;
}

// ─── Pending shipment (form state before dispatch) ────────────────────────────

export interface PendingShipment {
  origin:              string;
  destination:         string;
  vehicleType:         string;
  cargoType:           string;
  urgency:             string;
  deadline?:           string;
  insurance?:          string;
  tempSensitive?:      string;
  // Geoapify coordinate data
  originName?:         string;
  originAddress?:      string;
  originLat?:          number;
  originLng?:          number;
  originPlaceId?:      string;
  destinationName?:    string;
  destinationAddress?: string;
  destinationLat?:     number;
  destinationLng?:     number;
  destinationPlaceId?: string;
  // Cargo + schedule
  cargoWeightKg?:      number;
  cargoVolumeM3?:      number;
  plannedDeparture?:   string;
  plannedArrival?:     string;
}

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface AnalyzeRoutesRequest {
  origin:      string;
  destination: string;
  cargoType:   string;
  vehicleType: string;
  urgency:     string;
  originLat?:          number;
  originLng?:          number;
  destinationLat?:     number;
  destinationLng?:     number;
  // Module 5
  priority?:           string;
  deadline?:           string;
}

export interface AnalyzeRoutesResponse {
  routes:       Route[];
  analyzedAt:   string;
  source?:      string;
  weatherScore?: number;
}

export interface CreateShipmentRequest {
  origin:              string;
  destination:         string;
  vehicleType:         string;
  cargoType:           string;
  urgency:             string;
  routeId:             string;
  routeName:           string;
  riskScore:           number;
  riskLevel:           RiskLevel;
  eta:                 string;
  distance:            string;
  confidencePercent:   number;
  predictiveAlert?:    string;
  /** Full breakdown from the route analysis - stored on the shipment */
  riskBreakdown?:      RiskBreakdown;
  // Geoapify coordinate data (optional - gracefully absent for legacy shipments)
  originName?:         string;
  originAddress?:      string;
  originLat?:          number;
  originLng?:          number;
  originPlaceId?:      string;
  destinationName?:    string;
  destinationAddress?: string;
  destinationLat?:     number;
  destinationLng?:     number;
  destinationPlaceId?: string;
  // Cargo + schedule
  cargoWeightKg?:      number;
  cargoVolumeM3?:      number;
  plannedDeparture?:   string;
  plannedArrival?:     string;
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

// ─── Company Settings (Task 2 - Module 1 Finalization) ────────────────────────

export interface CompanySettings {
  companyId:            string;
  // ─── Multilingual ──────────────────────────────────────────────────────────
  language:             string;    // default "en" - company workspace default language
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

// ─── Audit event types (Task 3 - Module 1 Finalization) ──────────────────────

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
  | "shipment_incident"
  // Module 5B Audit Events
  | "trip_started"
  | "trip_paused"
  | "trip_resumed"
  | "checkpoint_arrived"
  | "checkpoint_departed"
  | "driver_changed"
  | "vehicle_changed"
  | "eta_changed"
  | "route_deviation"
  | "trip_cancelled"
  // Module 9 Audit Events
  | "report_generated"
  | "analytics_exported"
  | "dashboard_accessed"
  // Module 10 — platform lifecycle events
  | "company_reactivated";

// ─── Module 2 - Workforce Management types ───────────────────────────────────

export interface Driver {
  // ─── Identity ─────────────────────────────────────────────────────────────
  driverId:                string;      // "drv-<timestamp>-<random4>"
  companyId:               string;      // tenant key - indexed
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
  operationalStatus?:      "Available" | "Assigned" | "Driving" | "Paused" | "Offline" | "Completed";
  assignedVehicleId:       string | null;

  // ─── Module 3/4/5 Future Fields ───────────────────────────────────────────
  shipmentIds:             string[];    // default [] - Module 3 linkage
  communicationChannelId:  string | null; // default null - Module 3 comm layer
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
  operationalStatus?:      "Available" | "Assigned" | "In Transit" | "Maintenance" | "Offline";
  currentDriverId:         string | null;

  // ─── Module 3/4 Future Fields ─────────────────────────────────────────────
  shipmentIds:             string[];    // default [] - Module 3 linkage
  trackingDeviceId:        string | null; // default null - Module 4 tracking

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
  timestamp:   string;       // UTC ISO - immutable, never updated
}

// ─── Module 3 - Operational Intelligence Platform ─────────────────────────────

export type IncidentCategory = "Weather" | "Traffic" | "Road Closure" | "Accident" | "Construction" | "Political" | "Public Event" | "Natural Disaster" | "Restriction" | "Unknown";

export interface IncidentTimelineEvent {
  eventType:  "created" | "assigned" | "escalated" | "acknowledged" | "note_added" | "resolved";
  timestamp:  string;
  actorId?:   string;
  actorName?: string;
  note?:      string;
}

export interface Incident {
  incidentId:         string;
  companyId?:         string; // Optional, some incidents might be company specific but usually global
  ownerId?:           string; // Command Center owner
  title:              string;
  description:        string;
  category:           IncidentCategory;
  severity:           "low" | "medium" | "high" | "critical";
  priority?:          "low" | "medium" | "high" | "critical";
  commandStatus?:     "open" | "investigating" | "mitigating" | "resolved";
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
  actionsTaken?:      string[];
  resolution?:        string;
  relatedShipmentId?: string;
  relatedVehicleId?:  string;
  relatedDriverId?:   string;
  affectedState?:     string;
  affectedCity?:      string;
  logisticsImpact?:   string;
  estimatedDelayMinutes?: number;
  // Assignment & escalation
  assignedToId?:      string; // userId of the assignee
  assignedToName?:    string;
  assignedAt?:        string;
  slaDeadline?:       string; // ISO timestamp – when must be resolved
  slaBreached?:       boolean;
  escalationLevel?:   number; // 0 = normal, 1 = escalated, 2 = critical
  timeline?:          IncidentTimelineEvent[];
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
  | "Shipment Completed"
  | "Shipment Cancelled"
  // Module 5B Timeline Events
  | "Trip Started"
  | "Trip Paused"
  | "Trip Resumed"
  | "Checkpoint Arrived"
  | "Checkpoint Departed"
  | "Route Deviation"
  | "Route Corridor Breach"
  // Module 6 Operational Intelligence Events
  | "Recommendation Generated"
  | "Recommendation Assigned"
  | "Recommendation Viewed"
  | "Recommendation Accepted"
  | "Recommendation Rejected"
  | "Recommendation Executed"
  | "Recommendation Completed"
  | "Recommendation Cancelled"
  | "Recommendation Expired"
  | "Recommendation Approved"
  | "Recommendation Overridden"
  | "Recommendation Escalated"
  | "Recommendation Delegated"
  | "Risk Escalated"
  | "Shipment Assigned"
  | "Driver Assigned"
  | "Vehicle Assigned"
  | "Vehicle Maintenance"
  | "Driver Suspension"
  | "Incident Reported"
  | "Risk Increased"
  | "Risk Decreased"
  | "Risk Reduced"
  | "Auto Reroute"
  | "Auto ETA Update"
  | "Driver Reassignment"
  | "Vehicle Replacement"
  | "Priority Escalated"
  | "System Decision";

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
  shipmentCount:         number;
  completedShipments:    number;
  delayedShipments:      number;
  averageDelay:          number; // minutes
  averageEtaVariance:    number; // minutes
  averageTravelTime:     number; // minutes
  averageRiskScore:      number; // 0-100
  weatherRisk:           number; // 0-100
  trafficRisk:           number; // 0-100
  festivalRisk:          number; // 0-100
  newsRisk:              number; // 0-100
  incidentDensity:       number; // 0-100 (incident count can be derived)
  incidentCount:         number;
  rerouteCount:          number;
  historicalReliability: number; // 0-100 (reliability percentage)
  volatilityScore:       number; // 0-100
  operationalHealth:     number; // 0-100
  riskHistory:           number[]; // trend over time
  weatherTrend:          "clear" | "rainy" | "stormy" | "foggy";
  roadQuality:           number; // 0-100
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
  fileName?:   string; // original filename for attachments
  timestamp:   string;
  readStatus:  boolean;
  readAt?:     string; // ISO timestamp of when the other party read it
}

export type AlertCategory = "Weather" | "Traffic" | "Incident" | "Driver" | "Vehicle" | "Compliance" | "Route" | "Execution" | "Delay" | "Prediction";

export interface OperationalAlert {
  alertId:           string;
  companyId:         string;
  title?:            string;
  description?:      string;
  category?:         AlertCategory;
  severity:          "low" | "medium" | "high" | "critical";
  confidence:        number;
  source?:           string;
  status?:           "active" | "resolved" | "acknowledged";
  reason?:           string;
  recommendedAction?: string;
  shipmentId?:       string;
  driverId?:         string;
  vehicleId?:        string;
  corridorId?:       string;
  incidentId?:       string;
  suggestedAction?:  string;
  acknowledged?:     boolean;
  resolved?:         boolean;
  escalated?:        boolean;
  timestamp:         string;
  snoozeUntil?:      string; // ISO timestamp – suppress until this time
}

export type RecommendationType = 
  | "Reassign Driver"
  | "Replace Vehicle"
  | "Delay Dispatch"
  | "Advance Dispatch"
  | "Change Route"
  | "Increase Monitoring"
  | "Pause Shipment"
  | "Continue Normally"
  | "Split Cargo"
  | "Escalate to Operations Manager";

export type RecommendationLifecycleStatus = "generated" | "assigned" | "viewed" | "accepted" | "rejected" | "executed" | "completed" | "cancelled" | "expired";

export interface OperationalRecommendation {
  recommendationId:  string;
  shipmentId:        string;
  companyId:         string;
  type:              RecommendationType;
  reason:            string;
  confidence:        number;
  affectedMetrics:   string[];
  tradeoffs:         string[];
  estimatedImpact:   string;
  severity:          "low" | "medium" | "high" | "critical";
  status:            "pending" | "accepted" | "rejected" | "resolved";
  lifecycleStatus:   RecommendationLifecycleStatus;
  createdAt:         string;
  assignedTo?:       string;
  assignedAt?:       string;
  viewedAt?:         string;
  viewedBy?:         string;
  resolvedAt?:       string;
  resolvedBy?:       string;
  executedAt?:       string;
  completedAt?:      string;
  cancelledAt?:      string;
  expiredAt?:        string;
}

export interface OperationalHealthScore {
  companyId:         string;
  score:             number; // 0-100
  status:            "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
  activeShipments:   number;
  averageRisk:       number;
  driverAvailability: number;
  vehicleAvailability: number;
  incidentDensity:   number;
  routeConfidence:   number;
  delayedShipments:  number;
  complianceScore:   number;
  calculatedAt:      string;
}

// ─── Module 4 - Shipment Assignment ──────────────────────────────────────────

export interface ShipmentAssignment {
  assignmentId:    string;
  shipmentId:      string;
  companyId:       string;
  driverId:        string;
  driverName:      string;
  vehicleId:       string;
  vehicleNumber:   string;
  assignedBy:      string;  // userId
  assignedAt:      string;  // UTC ISO
  unassignedAt?:   string;  // UTC ISO - set when reassigned/unassigned
  active:          boolean;
}

// ─── Module 5B - Active Fleet Operations & Execution ───────────────────────

export type ShipmentExecutionStatus = "pending" | "driving" | "paused" | "completed" | "cancelled";
export type ShipmentCheckpointStatus = "pending" | "arrived" | "departed" | "skipped";

export interface ShipmentCheckpoint {
  id:            string;
  name:          string;
  latitude:      number;
  longitude:     number;
  arrivalETA?:   string;
  arrivalTime?:  string;
  departureTime?: string;
  status:        ShipmentCheckpointStatus;
}

export interface DriverLocation {
  latitude:  number;
  longitude: number;
  heading?:  number;
  speed?:    number;
  accuracy?: number;
  timestamp: string;
}

export interface ShipmentExecution {
  shipmentId:            string; // unique across active executions
  companyId:             string;
  driverId:              string;
  vehicleId:             string;
  driverAccepted?:       boolean;
  
  plannedRoute:          Route;
  currentRoute:          Route;
  routeVersion:          number;
  
  tripStartTime?:        string;
  tripEndTime?:          string;
  
  lastKnownLocation?:    DriverLocation;
  historicalLocations:   DriverLocation[]; // Keep last 100
  lastUpdated:           string;
  
  currentCheckpoint?:    string; // checkpoint id
  completedCheckpoints:  number;
  remainingCheckpoints:  number;
  checkpoints:           ShipmentCheckpoint[];
  
  currentETA?:           string;
  remainingDistance?:    number; // in meters or km
  travelledDistance:     number; // in meters or km
  
  averageSpeed:          number;
  maximumSpeed:          number;
  
  idleDuration:          number; // seconds
  drivingDuration:       number; // seconds
  
  fuelEstimate:          number;
  status:                ShipmentExecutionStatus;
  podSignatureSvg?:      string;
  podPhotoUrl?:          string; // Firebase Storage URL for delivery photo
}

// ─── Module 7 - Notification Engine (Phase 1) ───────────────────────────────

export type NotificationType = 
  | "shipment_created"
  | "shipment_completed"
  | "route_changed"
  | "incident_reported"
  | "recommendation_generated"
  | "recommendation_accepted"
  | "critical_weather"
  | "geofence_alert"
  | "vehicle_compliance";

export interface AppNotification {
  id:          string;
  companyId:   string;
  userId:      string;
  type:        NotificationType;
  severity:    "low" | "medium" | "high" | "critical";
  title:       string;
  message:     string;
  metadata?:   Record<string, unknown>;
  read:        boolean;
  createdAt:   string;
  readAt?:     string;
}
