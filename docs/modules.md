# Platform Modules

SentinelRoute has completed eleven production modules. Each module builds strictly on top of the previous ones -later modules consume earlier module APIs but never modify earlier module code.

**Related:** [Architecture](architecture.md) · [API Reference](api-reference.md) · [Database](database.md) · [Back to README](../README.md)

---

## Module Dependency Graph

```
Module 1 (Auth + Company)
  └── Module 2 (Workforce)
        └── Module 4 (Assignment)
              └── Module 5 (Execution)
  └── Module 3 (Operational Intelligence)
        └── Module 6 (Recommendations)
              └── Module 7 (Real-Time)
                    └── Module 8 (Collaboration)
  └── Module 9 (Analytics)
  └── Module 10 (Operational Feed)
  └── Module 11 (Settings)
```

---

## Module 1 -Authentication & Company Onboarding

**Purpose:** Establish the identity, tenancy, and authorization foundation for the entire platform.

**Major Features:**
- Firebase Authentication as the sole identity provider (`onAuthStateChanged`, ID token verification via Firebase Admin SDK)
- Company registration workflow with document upload (GST, PAN, insurance, transport licence, fleet insurance)
- Super Admin review portal -approve, reject, suspend, or reactivate company accounts
- Role-based access control with seven roles: `company_admin`, `super_admin`, `company_manager`, `operations_manager`, `fleet_manager`, `dispatcher`, `driver`
- Company status guards in `(app)/layout.tsx` -pending, rejected, suspended, and approved states each produce distinct routing behavior
- Immutable `CompanyAudit` records for every company lifecycle event
- Company settings with multilingual support (`language`, `supportedLanguages`, `fallbackLanguage`, `timezone`)
- User settings with per-user language preference and configurable risk thresholds

**Integration:** All subsequent modules derive `companyId` from the authenticated user's `UserRecord`. No module accepts `companyId` from request parameters.

**Outcome:** Every user operates within an isolated, approval-gated company workspace. The identity and tenancy contract is enforced at every API layer.

---

## Module 2 -Organization & Workforce Management

**Purpose:** Give approved companies the ability to manage their driver pool, vehicle fleet, and internal user accounts through a role-based hierarchy.

**Major Features:**
- Driver records with full profile: licence number and expiry, Aadhaar (AES-256 encrypted at rest), blood group, address, language preferences
- Vehicle records with registration, fuel type, capacity, insurance number, insurance/permit/fitness expiry dates
- Driver–vehicle assignment enforced as a strict one-to-one relationship using MongoDB sessions for atomicity
- Suspension cascade: suspending a driver automatically clears `assignedVehicleId` on the driver and `currentDriverId` on the vehicle in a single atomic session
- Soft-delete pattern: no driver or vehicle record is physically deleted; status transitions to `"inactive"`
- `ExpiryBadge` component with 30-day warning threshold -badge mode for tables, indicator mode for profile pages
- `WorkforceAudit` -immutable audit records for every driver, vehicle, and user management action
- Company Manager user management: invite users, assign roles, disable/activate accounts
- Self-modification guard: a Company Manager cannot modify their own role or disable their own account
- Workforce Dashboard API: live MongoDB aggregation for driver/vehicle counts, recent activity, and upcoming expirations

**Integration:** Workforce data is linked to shipments in Module 4. Driver and vehicle records carry forward-compatible `shipmentIds` and `trackingDeviceId` fields.

**Outcome:** Fleet and driver data is always current, auditable, and tenant-isolated. Assignment integrity is guaranteed by session-level atomicity.

---

## Module 3 -Operational Intelligence Platform

**Purpose:** Surface real-time operational awareness across incidents, alerts, recommendations, corridor health, and shipment communication.

**Major Features:**
- Incident management: create, classify, update, and resolve incidents with category, severity, affected radius, and logistics impact
- Command Center: company-scoped incident command with `commandStatus` lifecycle (open, investigating, mitigating, resolved)
- Operational alerts with typed categories: Weather, Traffic, Incident, Driver, Vehicle, Compliance, Route, Execution, Delay, Prediction
- Recommendation Engine: typed recommendations (`Reassign Driver`, `Replace Vehicle`, `Change Route`, `Delay Dispatch`, `Advance Dispatch`, `Increase Monitoring`, `Pause Shipment`, `Split Cargo`, `Escalate to Operations Manager`)
- Full recommendation lifecycle: generated → assigned → viewed → accepted → rejected → executed → completed → cancelled/expired
- Shipment timeline: immutable, append-only event stream per shipment covering 40+ typed event types
- Shipment communication channels: per-shipment message threads with text, system, image, and PDF message types
- Heatmap: geographic incident density visualization on an interactive Leaflet map
- Corridor Intelligence: per-corridor aggregation of historical reliability, average delay, weather/traffic/festival risk, and incident density
- Risk Center: company-wide risk scoring with alert severity distribution
- Operational health score with sub-components: driver availability, vehicle availability, route confidence, incident density, compliance score

**Integration:** Timeline events are created by shipment workflows, recommendation engine, and real-time socket events. The operational feed is delivered to all connected clients via Socket.io.

**Outcome:** Dispatchers and operations managers have a live, structured view of every risk factor affecting active shipments -before and during execution.

---

## Module 4 -Shipment Assignment & Fleet Operations

**Purpose:** Link the workforce layer to the shipment layer by enabling dispatcher-controlled driver and vehicle assignment with full audit trails.

**Major Features:**
- `ShipmentAssignment` records linking a shipment to a driver and vehicle with timestamps and active/inactive state
- Assignment API at `POST /api/shipments/[id]/assign` -validates driver and vehicle belong to the same company, checks availability, updates shipment record
- Shipment detail page shows assigned driver name, vehicle number, and assignment timestamp
- Driver and vehicle profile pages display assigned shipment context
- Fleet Operations page (`/fleet-ops`) showing active vehicle deployments
- Driver Operations page (`/driver-ops`) showing driver workload and operational status
- Cargo metadata fields on shipments: `cargoWeightKg`, `cargoVolumeM3`, `insuranceType`, `temperatureRequirement`, `priority`, `deadline`

**Integration:** Assignment data is used by the execution engine in Module 5 and surfaced in analytics in Modules 9 and 11.

**Outcome:** Every active shipment has a known driver and vehicle. Assignment history is maintained through the `ShipmentAssignment` collection.

---

## Module 5 -Route Intelligence & Execution Engine

**Purpose:** Add live trip execution tracking to active shipments with checkpoint management, location updates, and route deviation detection.

**Major Features:**
- `ShipmentExecution` records: trip status, current route, route version, driver location history (last 100 points), checkpoint progress
- Trip workflow transitions: pending → driving → paused → completed/cancelled
- Checkpoint system with arrival/departure tracking and ETA per checkpoint
- Driver location updates via `POST /api/execution/[id]/location`
- Checkpoint events via `POST /api/execution/[id]/checkpoint`
- Trip workflow transitions via `POST /api/execution/[id]/workflow`
- Active executions feed at `GET /api/execution/active`
- Geoapify autosuggest integration for location search in shipment creation
- Route Intelligence page (`/route-intelligence`) with corridor volatility and confidence scoring
- Route confidence scoring using weather confidence, incident density, traffic stability, and historical corridor reliability
- Extended route fields: `averageSpeed`, `trafficDelay`, `weatherSummary`, `roadIncidents`, `confidenceScore`, `predictionConfidence`, `historicalReliability`, `fuelEstimate`, `carbonEstimate`

**Integration:** Execution events are written to the shipment timeline. Location updates feed the heatmap and corridor statistics.

**Outcome:** Dispatchers have live visibility into active trips with structured checkpoint progress and deviation awareness.

---

## Module 6 -Recommendation Engine & Decision Workspace

**Purpose:** Automate operational decision support by generating, assigning, and tracking structured recommendations through a full lifecycle.

**Major Features:**
- Recommendation generation with type, reason, confidence, affected metrics, tradeoffs, and estimated impact
- Full lifecycle status machine: generated → assigned → viewed → accepted → rejected → executed → completed → cancelled → expired
- Recommendations API: `GET /api/intelligence/recommendations`, `PATCH /api/intelligence/recommendations/[id]`
- Timeline integration: every lifecycle transition appends a typed event to the shipment timeline
- Decision workspace UI showing active recommendations grouped by severity
- Recommendation sync over Socket.io -all company members see recommendation state changes in real time
- Recommendations analytics at `GET /api/analytics/recommendations`

**Integration:** Recommendations reference shipment, driver, and vehicle IDs. Lifecycle transitions are reflected on the shipment timeline and in the operational feed.

**Outcome:** Operations managers have a structured, auditable decision workflow. No recommendation is lost or untracked.

---

## Module 7 -Real-Time Platform

**Purpose:** Build a production-grade Socket.io event infrastructure that supports company rooms, entity rooms, presence tracking, and typed event channels.

**Major Features:**
- Company room management: clients join `company:{companyId}` on connect and re-join on reconnect
- Entity rooms for shipment-level collaboration: clients can join `entity:{shipmentId}` for per-shipment presence
- Presence tracking: `presence:updated`, `presence:entity:joined`, `presence:entity:left`, `presence:sync` events
- Live operational feed delivery: `feed:updated`, `health:updated`, `sync:refresh_feed`
- KPI push: `kpi:updated` event updates dashboard cards without polling
- Shipment events: `shipment:created`, `shipment:status`, `shipment:updated`
- `useSocket` hook with handler map, `on/off` lifecycle management, and `emit` capability
- Polling fallback: 30-second interval when `NEXT_PUBLIC_ENABLE_WEBSOCKET` is not set (Vercel / serverless)
- Token refresh and auth failure handling in the store's `fetchWithAuth` wrapper

**Integration:** Every module that mutates state emits a corresponding Socket.io event. The store handles all event types and dispatches to the reducer.

**Outcome:** All connected clients share a live, consistent view of operational state without requiring manual refreshes.

---

## Module 8 -Enterprise Collaboration

**Purpose:** Enable structured communication within shipment contexts through persistent message channels.

**Major Features:**
- `ShipmentChannel` records -one channel per shipment, created on first message
- `ShipmentMessage` records with sender type, sender role, message type (text, system, image, PDF), and read status
- Communication channel API under `/api/intelligence/shipments/[id]/`
- Role-typed senders: Dispatcher, Driver, Operations Manager, System
- Message history displayed on shipment detail pages
- System messages automatically generated for timeline events (dispatch, risk changes, recommendations)

**Integration:** Channels and messages are tenant-scoped by `companyId`. System messages are created by the recommendation engine and execution workflow.

**Outcome:** All shipment-level communication is captured, auditable, and available to authorized company users.

---

## Module 9 -Executive Analytics & Reporting

**Purpose:** Provide company admins and operations managers with deep-dive reporting and trend analysis across all operational dimensions.

**Major Features:**
- Analytics API suite with eleven endpoints: `/api/analytics/shipments`, `/api/analytics/fleet`, `/api/analytics/drivers`, `/api/analytics/risk`, `/api/analytics/operational`, `/api/analytics/predictions`, `/api/analytics/recommendations`, `/api/analytics/trends`, `/api/analytics/kpis`, `/api/analytics/company`, `/api/analytics/reports`
- Executive Summary page with tabbed sub-views: Shipments, Fleet, Drivers, Operational, Risk, Predictions, Recommendations
- KPI cards derived from live MongoDB aggregation queries
- Shipment volume chart (7-week trend), risk distribution pie chart, route preference breakdown
- Risk trend analysis with anomaly detection indicators
- Fleet utilization reporting: available vs assigned vs maintenance ratios
- Driver performance reporting: active vs inactive, assignment frequency, suspension history
- PDF and XLSX export via `jspdf`, `jspdf-autotable`, and `xlsx`
- Report engine in `src/lib/analytics/report-engine.ts`
- Role-gated: `company_admin`, `operations_manager`, and `super_admin` only

**Integration:** All analytics queries are scoped by `companyId`. Super Admin receives cross-company views.

**Outcome:** Leadership has a single, accurate view of operational performance without relying on manual data extraction.

---

## Module 10 -Operational Feed & Health Score

**Purpose:** Aggregate all operational signals into a unified company-level feed and health score that update in real time.

**Major Features:**
- Operational feed API at `GET /api/operational/feed` -aggregates recent incidents, alerts, recommendations, and shipment events into a time-ordered feed scoped to the company
- Operational health score API at `GET /api/operational/health` -computes a 0–100 score with sub-components: active shipments, average risk, driver availability, vehicle availability, incident density, route confidence, delayed shipments, compliance score
- `OperationalHealthScore` type with `status` labels: Excellent, Good, Fair, Poor, Critical
- Feed and health pushed via `feed:updated` and `health:updated` Socket.io events on state changes
- 30-second polling fallback for serverless deployments

**Integration:** The feed and health score are rendered on the dashboard and consumed by the Command Center.

**Outcome:** Every operational stakeholder has a continuously updated summary of company health without navigating multiple pages.

---

## Module 11 -Settings, User Preferences & Multilingual Foundation

**Purpose:** Give users and companies control over their operational defaults, notification preferences, and language settings.

**Major Features:**
- User settings API at `GET/PATCH /api/settings` -persists per-user preferences in MongoDB
- Settings fields: notification toggles (risk alerts, dispatch confirmation, disruptions, completion summary, weather warnings, analytics digest), risk thresholds (auto-flag, require-approval, auto-block), preferred route type, default vehicle type, dispatch confirmation window
- Per-user language preference stored on `UserRecord.preferredLanguage`
- Company language settings: `preferredLanguage`, `supportedLanguages`, `fallbackLanguage`
- Language update APIs: `PATCH /api/company/language`, `PATCH /api/user/language`
- `useI18nCompany` hook syncs the UI locale from the company/user language preference on app load
- Settings page (`/settings`) with Company Profile tab and User Preferences tab

**Integration:** Language preferences are consumed by all display layers. Risk thresholds from user settings influence the analytics dashboard's risk classification logic.

**Outcome:** Each user and company can configure the platform's behavior to match their operational context and regional preferences.

---

## System Capabilities Checklist

<details>
<summary>View full capability checklist (100+ capabilities)</summary>

### AI & Intelligence
- [x] Gemini AI explanation per shipment
- [x] Explainable recommendation engine
- [x] Confidence scores on all AI outputs
- [x] Weather corridor sampling (5 parallel OpenWeather calls)
- [x] Deterministic, auditable risk scoring
- [x] Route confidence scoring
- [x] Corridor volatility scoring
- [x] Predictive ETA with confidence interval
- [x] Festival risk factor
- [x] Historical corridor reliability scoring
- [x] Incident density scoring
- [x] Traffic stability scoring

### Operations
- [x] Multi-route generation (fastest, balanced, safest)
- [x] Shipment creation pipeline with 11-step processing
- [x] Shipment Pass with SHA-256 integrity hash
- [x] Shipment status lifecycle (draft, active, at-risk, completed, cancelled)
- [x] Trip execution workflow (pending, driving, paused, completed, cancelled)
- [x] Checkpoint management with arrival/departure tracking
- [x] Route deviation detection
- [x] Live driver location updates
- [x] Operational health score
- [x] Operational feed aggregation
- [x] Command Center with incident command lifecycle
- [x] Risk Center with company-wide risk scoring
- [x] Corridor Intelligence with historical aggregations
- [x] Heatmap with geographic incident density

### Fleet
- [x] Vehicle registration with full document management
- [x] Insurance, permit, and fitness expiry tracking
- [x] 30-day expiry warning indicators
- [x] Vehicle status lifecycle (available, assigned, maintenance, inactive)
- [x] Soft delete -no vehicle record is ever destroyed
- [x] Fleet Operations dashboard
- [x] Vehicle profile with audit history
- [x] Operational status tracking (In Transit, Maintenance, etc.)
- [x] Vehicle–driver assignment with atomic session writes

### Drivers
- [x] Driver profiles with full personal, licence, and contact information
- [x] Licence expiry tracking with colour-coded indicators
- [x] Aadhaar encryption at rest (AES-256-GCM)
- [x] Aadhaar masking for non-manager roles
- [x] Driver status lifecycle (active, inactive, suspended)
- [x] Suspension cascade unassigns vehicle atomically
- [x] Driver Operations dashboard
- [x] Driver profile with audit history
- [x] Language preferences per driver
- [x] Driver self-view guard (drivers see only their own profile)

### Shipments
- [x] Unique SR-XXXX shipment ID with uniqueness loop
- [x] Full coordinate-aware origin and destination via Geoapify
- [x] Cargo metadata (weight, volume, temperature, insurance type)
- [x] Driver and vehicle assignment on shipments
- [x] Shipment timeline -immutable, 40+ event types
- [x] Shipment communication channels
- [x] Shipment detail page with risk panel
- [x] Status update via PATCH with socket broadcast

### Security
- [x] Firebase Authentication (email + Google)
- [x] Firebase Admin SDK token verification on every API route
- [x] Token refresh on 401 with sign-out on second failure
- [x] Role-based access control (7 roles)
- [x] Tenant isolation via companyId from server-side UserRecord
- [x] IDOR protection on driver/vehicle detail endpoints
- [x] Zod validation on all API inputs
- [x] AES-256-GCM field encryption for sensitive data
- [x] SHA-256 route integrity hashing
- [x] Immutable audit logs (insert-only, no update/delete)
- [x] Self-modification guard for user management
- [x] Super Admin read-only on company workforce data

### Analytics
- [x] Eleven analytics API endpoints
- [x] Shipment volume trend (7-week chart)
- [x] Risk distribution (pie chart)
- [x] Route preference breakdown
- [x] Fleet utilization reporting
- [x] Driver performance reporting
- [x] KPI cards derived from live aggregations
- [x] PDF export (jsPDF + jspdf-autotable)
- [x] XLSX export (xlsx)
- [x] Executive summary with tabbed sub-views
- [x] Predictions analytics
- [x] Recommendations analytics

### Collaboration & Realtime
- [x] Socket.io company rooms
- [x] Socket.io entity rooms (per-shipment)
- [x] Live presence tracking
- [x] Operational feed via Socket.io
- [x] Health score via Socket.io
- [x] KPI push via Socket.io
- [x] Shipment event broadcast
- [x] Recommendation state sync
- [x] 30-second polling fallback for serverless
- [x] Automatic reconnection with re-join on reconnect

### Admin
- [x] Super Admin company review portal
- [x] Approve / reject / suspend / reactivate companies
- [x] Admin dashboard with platform-wide statistics
- [x] Admin audit log
- [x] Cross-company operational read for Super Admin
- [x] Seed super admin utility API
- [x] Platform health API

</details>
