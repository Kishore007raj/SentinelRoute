# API Reference

All API routes return responses in the envelope format `{ success: true, data: ... }` or `{ success: false, error: string }`. All routes require a valid Firebase ID token in the `Authorization: Bearer <token>` header unless noted.
---

## Response Envelope

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": "descriptive message" }
```

**Status Codes:**

| Code | Meaning |
|---|---|
| 200 | Successful GET or PATCH |
| 201 | Successful POST (resource created) |
| 400 | Zod validation failure -field-level error message |
| 401 | Missing or invalid Firebase ID token |
| 403 | Insufficient role or cross-company access denied |
| 404 | Resource not found |
| 409 | Assignment conflict (driver already assigned, vehicle not available) |
| 422 | Route not found (OSRM returned no result) |
| 500 | Unhandled server error or MongoDB write failure |

---

## Authentication & Company

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/api/company/register` | Any auth | Register a new company |
| POST | `/api/company/submit` | `company_admin` | Submit company for Super Admin verification |
| GET | `/api/company/me` | Any auth | Get current user's company and UserRecord |
| POST | `/api/company/documents` | `company_admin` | Upload a verification document |
| PATCH | `/api/company/language` | `company_admin` | Update company language settings |
| GET/PATCH | `/api/settings` | Any auth | Get or update user settings |
| PATCH | `/api/user/language` | Any auth | Update user language preference |

---

## Shipments

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/api/shipments` | Any company role | List all shipments for the company, sorted by `createdAt` desc |
| POST | `/api/shipments` | `dispatcher`, `company_admin`, `company_manager` | Create a shipment (full 11-step pipeline) |
| GET | `/api/shipments/[id]` | Any company role | Get a single shipment by MongoDB `_id` |
| PATCH | `/api/shipments/[id]` | Any company role | Update shipment status |
| POST | `/api/shipments/[id]/assign` | `dispatcher`, `fleet_manager`, `company_admin`, `company_manager` | Assign driver and vehicle to a shipment |

**POST /api/shipments pipeline (strict order):**
1. Parse request body
2. Zod validate → HTTP 400 on failure
3. Verify Firebase Auth token → HTTP 401 on failure
4. Generate unique `shipmentId` via uniqueness loop
5. Call OSRM for route data → HTTP 422 if no route
6. Sample 5 weather points in parallel (OpenWeather)
7. Compute `riskScore` and `riskLevel` (deterministic)
8. Call Gemini for AI explanation (one attempt + one retry on 429)
9. Write to MongoDB → HTTP 500 on failure
10. Emit `shipment:created` via Socket.io
11. Return HTTP 201 `{ success: true, data: shipment }`

---

## Workforce

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/api/workforce/drivers` | Read roles | List all drivers for the company |
| POST | `/api/workforce/drivers` | Write roles | Create a new driver |
| GET | `/api/workforce/drivers/[id]` | Read roles | Get driver by `driverId` |
| PATCH | `/api/workforce/drivers/[id]` | Write roles | Update driver fields or status |
| DELETE | `/api/workforce/drivers/[id]` | Write roles | Soft-delete (sets status to `"inactive"`) |
| GET | `/api/workforce/vehicles` | Read roles | List all vehicles for the company |
| POST | `/api/workforce/vehicles` | Write roles | Create a new vehicle |
| GET | `/api/workforce/vehicles/[id]` | Read roles | Get vehicle by `vehicleId` |
| PATCH | `/api/workforce/vehicles/[id]` | Write roles | Update vehicle fields, assign/unassign driver, or change status |
| DELETE | `/api/workforce/vehicles/[id]` | Write roles | Soft-delete (sets status to `"inactive"`) |
| GET | `/api/workforce/users` | `company_manager`, `company_admin` | List company users |
| POST | `/api/workforce/users` | `company_manager`, `company_admin` | Invite a new user |
| GET | `/api/workforce/users/[id]` | `company_manager`, `company_admin` | Get a company user |
| PATCH | `/api/workforce/users/[id]` | `company_manager`, `company_admin` | Change role, disable, or activate a user |
| GET | `/api/workforce/dashboard` | Dashboard roles | Workforce summary statistics |
| GET | `/api/workforce/audits` | Read roles | Workforce audit log |

**Read roles:** `company_admin`, `company_manager`, `fleet_manager`, `operations_manager`, `dispatcher`, `super_admin`

**Write roles:** `company_admin`, `company_manager`, `fleet_manager`

**Driver PATCH status transitions:**
- `"suspended"` -opens MongoDB session, clears `driver.assignedVehicleId`, sets `vehicle.currentDriverId = null` and `vehicle.status = "available"` atomically
- `"active"` (from suspended) -audit `driver_activated`
- Other fields -standard update + audit `driver_updated`

---

## Operational Intelligence

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/intelligence/incidents` | List or create incidents |
| GET/PATCH | `/api/intelligence/incidents/[id]` | Get or update an incident |
| GET/POST | `/api/intelligence/alerts` | List or create operational alerts |
| PATCH | `/api/intelligence/alerts/[id]` | Acknowledge or resolve an alert |
| GET | `/api/intelligence/recommendations` | List recommendations |
| PATCH | `/api/intelligence/recommendations/[id]` | Update recommendation lifecycle status |
| GET | `/api/intelligence/corridors` | Get corridor statistics |
| GET | `/api/intelligence/heatmap` | Get incident heatmap data |
| GET | `/api/intelligence/kpis` | Get operational KPIs |
| GET | `/api/intelligence/audit` | Get intelligence audit log |
| GET | `/api/operational/feed` | Get live operational feed |
| GET | `/api/operational/health` | Get operational health score |

---

## Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics/shipments` | Shipment analytics and trends |
| GET | `/api/analytics/fleet` | Fleet utilization analytics |
| GET | `/api/analytics/drivers` | Driver performance analytics |
| GET | `/api/analytics/risk` | Risk trend analytics |
| GET | `/api/analytics/operational` | Operational performance analytics |
| GET | `/api/analytics/predictions` | Prediction accuracy analytics |
| GET | `/api/analytics/recommendations` | Recommendation adoption analytics |
| GET | `/api/analytics/trends` | Multi-dimensional trend data |
| GET | `/api/analytics/kpis` | Company KPI summary |
| GET | `/api/analytics/company` | Company-level analytics (Super Admin only) |
| GET | `/api/analytics/reports` | Generate and export reports (PDF/XLSX) |

---

## Execution

| Method | Path | Description |
|---|---|---|
| GET | `/api/execution/active` | List active trip executions |
| GET/POST | `/api/execution/[id]` | Get or create a trip execution record |
| POST | `/api/execution/[id]/location` | Update driver GPS location |
| POST | `/api/execution/[id]/checkpoint` | Record checkpoint arrival or departure |
| POST | `/api/execution/[id]/workflow` | Transition trip workflow state (start, pause, resume, complete, cancel) |

---

## Admin

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/api/admin/companies` | `super_admin` | List all companies |
| GET/PATCH | `/api/admin/companies/[id]` | `super_admin` | Get or update a company (approve, reject, suspend) |
| GET | `/api/admin/dashboard` | `super_admin` | Platform-wide statistics |
| GET | `/api/admin/audit` | `super_admin` | Platform audit log |
| GET | `/api/admin/health` | `super_admin` | Platform health check |
| POST | `/api/admin/seed-super-admin` | Unauthenticated (one-time) | Seed the initial super admin user |

---

## Route Analysis

| Method | Path | Description |
|---|---|---|
| POST | `/api/analyze-routes` | Run full route analysis -OSRM + OpenWeather + risk scoring for all three route options |
| POST | `/api/ai-insight` | On-demand AI insight for a shipment or risk profile |
| GET | `/api/geoapify/autosuggest` | Proxy for Geoapify address autosuggest |
| GET | `/api/health` | Basic platform health check |
