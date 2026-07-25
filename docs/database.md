# Database Design

SentinelRoute uses MongoDB Atlas as its sole persistent data store. All collections are scoped by `companyId` for tenant isolation.

**Related:** [Architecture](architecture.md) · [Modules](modules.md) · [Performance](performance.md) · [API Reference](api-reference.md) · [Security](security.md) · [Back to README](../README.md)

---

## Collections

| Collection | Purpose | Key Indexes |
|---|---|---|
| `shipments` | Shipment records with route, risk, and assignment data | `shipmentId` (unique), `companyId`, `createdAt` (desc), `status` |
| `companies` | Company profiles with status, trust metrics, and settings | `companyId` (unique), `status` |
| `users` | UserRecord linking Firebase UID to company and role | `userId` (unique), `companyId` |
| `company_documents` | Company verification documents (Base64 encoded) | `companyId`, `documentId` (unique) |
| `company_audits` | Immutable company lifecycle events | `companyId`, `timestamp` (desc) |
| `company_settings` | Per-company operational and language settings | `companyId` (unique) |
| `user_settings` | Per-user notification and risk threshold preferences | `userId` (unique) |
| `drivers` | Driver records with licence and assignment data | `driverId` (unique), `companyId`, `companyId+status`, `companyId+licenseExpiry` |
| `vehicles` | Vehicle records with document expiry data | `vehicleId` (unique), `companyId`, `companyId+status`, expiry date indexes |
| `company_users` | User-to-company role bindings | `companyId+userId` (unique), `userId` |
| `workforce_audits` | Immutable workforce action records | `auditId` (unique), `companyId+timestamp` (desc), `companyId+targetId` |
| `incidents` | Operational incidents with geographic coordinates | `companyId`, `severity`, `startTime` |
| `shipment_timeline` | Immutable per-shipment event log | `shipmentId+companyId`, `timestamp` (desc) |
| `recommendations` | Typed operational recommendations with lifecycle | `shipmentId`, `companyId`, `lifecycleStatus` |
| `alerts` | Operational alerts with category and severity | `companyId`, `timestamp` (desc) |
| `corridors` | Historical corridor statistics | `origin+destination`, `companyId` |
| `ship_channels` | Per-shipment communication channel records | `shipmentId` (unique), `companyId` |
| `messages` | Shipment messages with sender type and read status | `channelId`, `timestamp` (desc) |
| `executions` | Active trip execution state with location history | `shipmentId` (unique), `companyId` |
| `assignments` | Driver-vehicle-shipment assignment history | `shipmentId`, `companyId`, `active` |
| `festivals` | Festival calendar for route risk scoring | `startDate`, `affectedStates` |

---

## Tenant Isolation Pattern

Every collection that stores company-scoped data uses `companyId` as the first field in every compound index. All API handlers resolve `companyId` from the server-side `UserRecord` and prepend `{ companyId }` to every MongoDB filter. `$project` stages in aggregations never expose cross-company documents.

---

## Immutability Pattern

`company_audits` and `workforce_audits` are insert-only collections. No API route provides an update or delete path for these collections. MongoDB does not enforce this at the storage level, but the application layer provides no mutation endpoints.

---

## Session Atomicity

Driver–vehicle assignment operations use MongoDB sessions (`startSession()` → `withTransaction()`) to ensure both the `drivers` and `vehicles` documents are updated atomically. If either write fails, the session rolls back both operations.

---

## Index Setup

MongoDB indexes are created at server startup via `ensureIndexes()` in `src/lib/mongodb.ts`, guarded by a flag to prevent repeated creation. The call is invoked from the first API handler that runs on process start.

**Key performance indexes:**
- `shipments.createdAt` (descending) -default sort for GET all shipments
- `drivers.companyId + licenseExpiry` -upcoming expiry queries
- `workforce_audits.companyId + timestamp` (descending) -recent activity queries
- `executions.shipmentId` (unique) -single execution lookup

**Workforce-specific indexes:**

Drivers:
- `{ companyId: 1 }`
- `{ companyId: 1, status: 1 }`
- `{ driverId: 1 }` (unique)
- `{ companyId: 1, licenseExpiry: 1 }`

Vehicles:
- `{ companyId: 1 }`
- `{ companyId: 1, status: 1 }`
- `{ vehicleId: 1 }` (unique)
- `{ companyId: 1, insuranceExpiry: 1 }`
- `{ companyId: 1, permitExpiry: 1 }`
- `{ companyId: 1, fitnessExpiry: 1 }`

Company Users:
- `{ companyId: 1 }`
- `{ userId: 1 }`
- `{ companyId: 1, userId: 1 }` (unique)

Workforce Audits:
- `{ companyId: 1, timestamp: -1 }`
- `{ companyId: 1, targetId: 1 }`
- `{ auditId: 1 }` (unique)
