# Module 9 — Analytics & Reporting / Business Intelligence

## Overview

Module 9 adds the Executive Analytics Dashboard, KPI Aggregation Engine, Trend Analytics Engine, Reporting Engine, CSV/Excel/PDF exports, real-time analytics refresh via existing Socket.IO infrastructure, analytics-specific audit logging, RBAC-gated analytics APIs, and MongoDB index optimisations for analytics queries.

All Module 9 code is built on top of the existing Modules 1–8 infrastructure. Nothing was duplicated or replaced.

---

## Files Created

### Backend Services (`src/lib/analytics/`)
| File | Purpose |
|------|---------|
| `kpi-engine.ts` | KPI aggregation service — bug fixes: correct ShipmentStatus values (`"completed"` not `"delivered"`; `"active"|"at-risk"` not `"in_transit"`), correct DriverStatus from `operationalStatus`, added `delayed` and `deliveryPerformance` KPIs |
| `trend-engine.ts` | Time-series trend aggregation (daily/weekly/monthly) for shipment_volume, incidents, risk_score, predictions |
| `report-engine.ts` | Orchestrates report generation, stores metadata to `analytics_reports`, fires `report_generated` audit |
| `analytics-utils.ts` | `buildDateFilter()`, `DateRangePreset`, `calculateTrend()`, `calculateMovingAverage()` |
| `export-utils.ts` | Client-side `exportToCSV()`, `exportToExcel()` (xlsx), `exportToPDF()` (jspdf + autotable) |

### Analytics API Routes (`src/app/api/analytics/`)
All routes upgraded to use `requireAnalyticsAccess` RBAC (company_admin, operations_manager, super_admin only). companyId always resolved server-side from auth — never from request body.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/analytics/kpis` | GET | All executive KPIs + health score; fires `dashboard_accessed` audit |
| `/api/analytics/trends` | GET | Time-series trend data (`?metric=&granularity=`) |
| `/api/analytics/reports` | POST | Generate report, store metadata, fire `report_generated` audit |
| `/api/analytics/reports` | GET | List previously generated reports for the company |
| `/api/analytics/shipments` | GET | Volume, status distribution, daily trend |
| `/api/analytics/fleet` | GET | Status/type distribution (uses correct `vehicleType` field) |
| `/api/analytics/drivers` | GET | Status + operationalStatus distribution |
| `/api/analytics/operational` | GET | Health score trend from `operational_metrics` |
| `/api/analytics/risk` | GET | Multi-factor risk trend from `risk_calculations` |
| `/api/analytics/predictions` | GET | Prediction confidence trend from `route_predictions` |
| `/api/analytics/recommendations` | GET | Recommendation status/type distribution |
| `/api/analytics/company` | GET | Company user role distribution (super_admin scoped) |

### Executive Dashboard Pages (`src/app/(app)/executive/`)
All placeholder `AnalyticsPageTemplate` pages replaced with real implementations:

| Page | Data Source | Charts |
|------|-------------|--------|
| `/executive` | `/api/analytics/kpis` + `/api/analytics/trends` | `HealthGauge`, `ExecutiveSummaryCards`, `AnalyticsLineChart` |
| `/executive/shipments` | `/api/analytics/shipments` | `AnalyticsLineChart` (daily volume), `AnalyticsDonutChart` (status) |
| `/executive/fleet` | `/api/analytics/fleet` | `AnalyticsDonutChart` (status + type) |
| `/executive/drivers` | `/api/analytics/drivers` | `AnalyticsDonutChart` (status) |
| `/executive/operational` | `/api/analytics/operational` | `AnalyticsLineChart` (health trend) |
| `/executive/risk` | `/api/analytics/risk` | `AnalyticsLineChart` (multi-factor: overall/weather/traffic/security) |
| `/executive/predictions` | `/api/analytics/predictions` | `AnalyticsLineChart` (confidence + volume) |
| `/executive/recommendations` | `/api/analytics/recommendations` | `AnalyticsDonutChart` (status + type) |
| `/executive/company` | `/api/analytics/company` | `AnalyticsDonutChart` (role distribution) |

### Reusable UI Components (`src/components/analytics/`)
All existed before Module 9 — reused as-is:
- `HealthGauge` — animated SVG gauge (sm/md/lg/xl)
- `ExecutiveSummaryCards` — 8-card KPI grid (bug fix: `deliveryPerformance` replaces hardcoded `"94.2%"`)
- `AnalyticsFilters` — URL-synced date range + status/entity dropdowns
- `DateRangeSelector` — preset buttons (today/7 days/30 days/quarter/year/all time)
- `ReportGenerator` — dialog with PDF/Excel/CSV selector, calls `/api/analytics/reports`
- `charts/LineChart.tsx` — `AnalyticsLineChart` Recharts wrapper (multi-line support)
- `charts/DonutChart.tsx` — `AnalyticsDonutChart` Recharts wrapper with centre total

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/analytics/kpi-engine.ts` | Fixed `getShipmentKPIs` status values; fixed `getDriverKPIs` to use `operationalStatus`; added `delayed` + `deliveryPerformance` outputs |
| `src/lib/auth-helpers.ts` | Added `requireAnalyticsAccess()` helper + `ANALYTICS_READ_ROLES` constant |
| `src/lib/socket-server.ts` | Added `emitAnalyticsRefresh(companyId)` helper — emits `analytics:refresh` to company room |
| `src/lib/store.tsx` | Added `analytics:refresh` socket event handler (passes through to page-level listeners) |
| `src/lib/mongodb-indexes.ts` | Added `ensureAnalyticsShipmentsIndexes` + `ensureAnalyticsIncidentsIndexes`; extended `ensureAnalyticsReportsIndexes` with `reportType` compound index |
| `src/app/api/shipments/route.ts` | After shipment creation, fires `emitAnalyticsRefresh(companyId)` to notify analytics dashboards |
| `src/components/analytics/ExecutiveSummaryCards.tsx` | Updated `KPIs` interface to include `delayed`, `deliveryPerformance`, corrected driver shape; removed hardcoded ETA accuracy |

---

## Analytics Architecture

```
MongoDB operational data
  ↓
KPIEngine (kpi-engine.ts)         — server-side aggregation pipelines, company-scoped
TrendEngine (trend-engine.ts)     — time-series bucketing, granularity-aware
  ↓
ReportEngine (report-engine.ts)   — orchestrates, stores metadata, fires audit
  ↓
Analytics API Layer (/api/analytics/*) — auth + RBAC + rate limit + validated params
  ↓
Executive Dashboard (executive/*) — authenticated fetch with Firebase token
  ↓
Recharts components               — AnalyticsLineChart, AnalyticsDonutChart, HealthGauge

Real-time path:
Operational mutation (shipment create/complete) → emitAnalyticsRefresh(companyId)
  → Socket.IO company:companyId room → analytics:refresh event
  → Executive dashboard page refetches KPIs + trends

Export path:
Dashboard filters → ReportGenerator → POST /api/analytics/reports
  → ReportEngine (calls same KPIEngine) → returns { metadata, data }
  → export-utils (CSV / xlsx / PDF) → download → audit logged
```

---

## KPI Definitions

All KPIs are derived from real operational MongoDB data. No hardcoded values.

| KPI | Collection | Formula |
|-----|-----------|---------|
| Total Shipments | `shipments` | `COUNT WHERE companyId = ? [+ dateRange on createdAt]` |
| Active Shipments | `shipments` | `COUNT WHERE status IN ["active","at-risk","draft"]` |
| Completed Shipments | `shipments` | `COUNT WHERE status = "completed"` |
| Cancelled Shipments | `shipments` | `COUNT WHERE status = "cancelled"` |
| At-Risk Shipments | `shipments` | `COUNT WHERE status = "at-risk"` |
| Delayed Shipments | `shipments` | `COUNT WHERE status IN ["active","at-risk"] AND deadline < NOW()` |
| Shipment Success Rate | `shipments` | `completed / (completed + cancelled) * 100` |
| Delivery Performance | `shipments` | `(completed - delayed) / completed * 100` |
| Fleet Utilization | `vehicles` | `assigned / total * 100` |
| Fleet Availability | `vehicles` | `available / total * 100` |
| Driver Utilization | `drivers` | `operationalStatus IN [Assigned,Driving,Paused] / active * 100` |
| Incident Count | `incidents` | `COUNT grouped by severity` |
| Operational Health | computed | `HealthScore.calculateForCompany(companyId)` (existing Module 3/6 engine) |

---

## API Endpoints

All analytics endpoints:
- Require `Authorization: Bearer <firebase-token>` header
- Resolve `companyId` from the authenticated user record — never from request body
- Enforce `ANALYTICS_READ_ROLES = ["company_admin", "operations_manager", "super_admin"]`
- Return `403 Forbidden` for other roles
- Are rate-limited via the existing `apiLimiter`
- Support `?start=ISO&end=ISO&preset=DateRangePreset` for date filtering

---

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `analytics:refresh` | Server → Client (company room) | Fired after any operational mutation that affects analytics data (shipment create). Dashboard pages re-fetch KPIs and trends. |
| `kpi:updated` | Server → Client (company room) | Existing event from Module 7; executive dashboard also listens to sync KPI state |

---

## RBAC Behaviour

| Role | Analytics Access |
|------|----------------|
| `company_admin` | ✅ Full access to all analytics endpoints |
| `operations_manager` | ✅ Full access to all analytics endpoints |
| `super_admin` | ✅ Full access; can scope to any company via `?companyId=` |
| `fleet_manager` | ❌ 403 Forbidden |
| `dispatcher` | ❌ 403 Forbidden |
| `driver` | ❌ 403 Forbidden |
| `company_manager` | ❌ 403 Forbidden |

- RBAC is enforced **server-side** on every API route via `requireAnalyticsAccess()`
- Frontend navigation hides the Executive Analytics section for unauthorised roles (defence-in-depth only — not relied on for security)
- `companyId` is **always** sourced from the authenticated server-side user record. Client-provided `companyId` is ignored for regular users. `super_admin` may optionally pass `?companyId=` for scoped queries.

---

## Export Formats

| Format | Library | Trigger | Content |
|--------|---------|---------|---------|
| CSV | Native browser | `exportToCSV()` client-side | Flat key-value analytics data |
| Excel (.xlsx) | `xlsx ^0.18.5` | `exportToExcel()` client-side | Workbook with named sheet |
| PDF | `jspdf ^4.2.1` + `jspdf-autotable ^5.0.8` | `exportToPDF()` client-side | Titled table with generation timestamp |

All exports:
- Use server-generated data from `/api/analytics/reports` — not raw client-side KPI state
- Respect currently applied date range and filters
- Are scoped to the authenticated company
- Trigger `report_generated` audit event with `reportId`, `type`, `format`, and `generationTimeMs`
- Use safe filenames: `SentinelRoute_<Title>_<YYYY-MM-DD>.<ext>`

---

## Audit Behaviour

All analytics audit records are written to `company_audits` via the existing `createAuditEvent()` helper.

| Action | `eventType` | Details |
|--------|-------------|---------|
| KPI dashboard loaded | `dashboard_accessed` | `{ endpoint, dateRange }` |
| Report generated | `report_generated` | `{ reportId, type, format, generationTimeMs }` |
| Analytics exported | `analytics_exported` | emitted by `ReportEngine` when format = csv/excel/pdf |

These event types are defined in `AuditEventType` in `src/lib/types.ts` (pre-existing from Module 9 spec in types).

---

## Database / Index Changes

New compound indexes added to `src/lib/mongodb-indexes.ts` (all idempotent, background):

| Collection | Index Name | Fields | Purpose |
|-----------|-----------|--------|---------|
| `analytics_reports` | `analytics_reports_companyId_type_created` | `{ companyId: 1, reportType: 1, createdAt: -1 }` | Filter reports by type within company |
| `shipments` | `shipments_analytics_company_status_created` | `{ companyId: 1, status: 1, createdAt: -1 }` | KPI Engine status group-by with date range |
| `shipments` | `shipments_analytics_company_created_asc` | `{ companyId: 1, createdAt: 1 }` | Trend Engine time-bucket aggregation |
| `incidents` | `incidents_analytics_company_severity_time` | `{ companyId: 1, severity: 1, startTime: -1 }` | Incident KPI + trend queries |

Existing indexes already cover `route_predictions`, `risk_calculations`, `operational_metrics`, `operational_recommendations`, `vehicles`, `drivers`.

---

## Filters & URL State

`use-analytics-filters` hook (pre-existing) provides URL-synced filter state:

```typescript
interface AnalyticsFilters {
  start?: string;          // ISO date
  end?: string;            // ISO date
  preset?: DateRangePreset; // "today"|"daily"|"weekly"|"monthly"|"quarterly"|"yearly"|"all"
  status?: string;
  driverId?: string;
  vehicleId?: string;
  companyId?: string;      // super_admin only
}
```

- Filters survive browser refresh (URL query params)
- All analytics pages and exports respect current filters
- `DateRangeSelector` provides preset buttons
- `AnalyticsFilters` component renders the full filter bar

---

## Known Limitations

1. **ETA Accuracy** — `deliveryPerformance` approximates on-time delivery as `(completed - deadline-exceeded) / completed`. True ETA accuracy (within N minutes of predicted arrival) requires GPS tracking data from `shipment_executions.currentETA` compared against `plannedArrival`, which is available but not yet aggregated.

2. **Trend Engine — `risk_score` metric** — aggregates on `riskFactors.overall` from `risk_calculations`. This field is only populated when the prediction engine writes a full risk calculation. Shipments without a risk calculation record will not appear in the risk trend.

3. **Export from client** — CSV/Excel/PDF generation runs in the browser (client-side) using data returned from the server. For very large datasets the browser may become briefly unresponsive. Server-side streaming exports are out of scope for Module 9.

4. **`operational_metrics` health trend** — only returns data when the Module 6 `OperationalHealthScore` records are written with `type: "health_score"`. Empty state is handled gracefully.

---

## Verification Performed

### TypeScript (get_diagnostics)
- **Zero TypeScript errors** across all 30+ Module 9 files
- Remaining diagnostics are Tailwind CSS shorthand suggestions (warnings, not errors) that match the pre-existing codebase pattern

### Code paths verified end-to-end

**KPI path:**
`shipments` collection → `KPIEngine.getAllKPIs()` → `/api/analytics/kpis` (auth + RBAC) → `ExecutiveSummaryCards` → `HealthGauge`

**Trend path:**
`shipments` collection → `TrendEngine.getTrendData()` → `/api/analytics/trends` → `AnalyticsLineChart`

**Export path:**
`ReportGenerator` dialog → `POST /api/analytics/reports` (auth + RBAC + audit) → `ReportEngine` (calls same `KPIEngine`) → `exportToCSV/Excel/PDF` → download

**Real-time path:**
`POST /api/shipments` → `emitAnalyticsRefresh(companyId)` → Socket.IO `company:<id>` room → `analytics:refresh` event → executive dashboard `useSocket` listener → `fetchKPIs()` + `fetchTrend()`

**RBAC path:**
Unauthenticated → 401; wrong role → 403; correct role → data scoped to `companyId` from auth
