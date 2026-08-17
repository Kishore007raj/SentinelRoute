# Engineering Hardening Walkthrough

> Production-grade hardening applied to SentinelRoute Modules 1–10.  
> No new business features. No UI redesign.

---

## Summary

Module 11 is a hardening pass. Every change either fixes a real defect, removes unsafe code, or improves production reliability. No existing API contracts were broken, no Modules 1–10 functionality was altered.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/hooks/use-debounce.ts` | Generic debounce hook — used by audit page server-side search |
| `src/app/api/admin/analytics/route.ts` | Real platform analytics with MoM growth from MongoDB |
| `docs/production-checklist.md` | Deployment checklist, backup strategy, recovery procedures |
| `docs/testing-strategy.md` | Testing inventory — implemented + honest gap documentation |
| `docs/module-11-walkthrough.md` | This file |
| `docs/module-11-acceptance.md` | Acceptance report |

---

## Files Modified

### Backend / Core Libraries

| File | What Changed |
|------|-------------|
| `src/lib/store.tsx` | Replaced `any` types for `operationalFeed`, `operationalHealth`, `kpis` with explicit interfaces (`OperationalFeedData`, `OperationalHealthData`, `StoredKPIData`). Fixed `KPI_UPDATE` action type. Fixed `fetchOperationalData` response casting. |

### Admin API Routes

| File | What Changed |
|------|-------------|
| `src/app/api/admin/dashboard/route.ts` | Fixed `incidents` query (was filtering `status: "open"` — field doesn't exist). Now queries `incident_events.commandStatus`. Added `adminLimiter` rate limiting. Added `workforce` KPIs. Excluded platform super-admin from user count. |
| `src/app/api/admin/audit/route.ts` | Fixed wrong collection (`audit_logs` → `company_audits`). Added server-side filtering (search, eventType, companyId, date range). Added `adminLimiter` rate limiting. |
| `src/app/api/admin/operational/route.ts` | Fixed non-existent `live_telemetry` collection — now uses `shipments` + `shipment_executions`. Added pagination. Added `adminLimiter`. |
| `src/app/api/admin/companies/[id]/route.ts` | Added lifecycle transition guard (prevents invalid state changes). Fixed `restore` audit event (`company_restored` → `company_reactivated`). Added `adminLimiter`. Switched to `ApiErrors` factory. Strips `_id` before response. |
| `src/app/api/admin/analytics/route.ts` | **New file.** Real MoM growth metrics from MongoDB aggregation. No hardcoded percentages. |

### Admin UI Pages

| File | What Changed |
|------|-------------|
| `src/app/admin/page.tsx` | Switched bare `fetch` → `fetchApi` (auth token injected). Updated response shape for new dashboard API (workforce KPIs, `incidents.active`). |
| `src/app/admin/audit/page.tsx` | Switched bare `fetch` → `fetchApi`. Replaced client-side text filter with server-side `?search=` parameter (debounced). Added `?eventType=`, `?companyId=`, date range filter params. |
| `src/app/admin/analytics/page.tsx` | Replaced hardcoded `+12.4%` / `+28.1%` with real data from `/api/admin/analytics`. Added `AnalyticsLineChart` for daily shipment volume. Accurate MoM trend badges. |
| `src/app/admin/support/page.tsx` | Removed fake "biometric authorization" and "CLI console" UI. Replaced with real read-only: company quick-search, audit center link, health center link. |
| `src/app/admin/operational/page.tsx` | Switched bare `fetch` → `fetchApi`. Updated response shape (execution state from `shipment_executions`). Added proper pagination. Added `useDebounce` for search. |
| `src/app/admin/companies/page.tsx` | Switched bare `fetch` → `fetchApi`. |
| `src/app/admin/companies/[id]/page.tsx` | Switched bare `fetch` → `fetchApi`. Added `fetchApi` import. |

### Types

| File | What Changed |
|------|-------------|
| `src/lib/types.ts` | Added `"company_reactivated"` to `AuditEventType` union (was missing — `restore` action had no valid audit event type). |

---

## Architecture Changes

### TypeScript `any` Elimination

Before Module 11, `store.tsx` had three `any` fields in `StoreState` and `StoreContextValue`:
- `operationalFeed: any | null`
- `operationalHealth: any | null`  
- `kpis: any | null`

These are now typed with explicit interfaces that reflect the actual API response shapes. No runtime behavior was changed — only type information was added.

### Admin API Auth

All admin UI pages previously called backend APIs with bare `fetch()` — no `Authorization` header. Since every admin API requires `requireSuperAdmin()`, these calls would fail in production with a 401. All pages now use `fetchApi()` from `src/lib/api-client.ts` which automatically injects the Firebase ID token.

### Audit Collection Fix

`/api/admin/audit` was querying a collection named `audit_logs` which does not exist. The actual audit collection is `company_audits`. All platform audit history was invisible. Fixed.

### Incident Count Fix

The dashboard was querying `incidents.status === "open"` — the `Incident` type has no `status` field. It has `commandStatus`. Fixed to query `incident_events.commandStatus` in `["open","investigating","mitigating"]`.

### Real Platform Analytics

`/admin/analytics` previously showed hardcoded `+12.4%` and `+28.1%` growth figures. These were fabricated. Module 11 replaces them with real MongoDB aggregation comparing this month vs last month for companies, shipments, and users.

---

## Security Changes

### `company_reactivated` Audit Event

The `restore` action in `/api/admin/companies/[id]` was mapping to `"company_restored"` — a string that is not in the `AuditEventType` union. This caused TypeScript to widen the type to `string` and silently accept the invalid value. Fixed: `"company_reactivated"` is now a proper member of `AuditEventType`.

### Lifecycle Transition Guard

`PATCH /api/admin/companies/[id]` now enforces valid state machine transitions:
- `pending` → `approve`, `reject`, `clarification`
- `approved` → `suspend`, `clarification`  
- `suspended` → `restore`, `clarification`
- `rejected` → `clarification` only

Previously any action could be applied to any status, including approving an already-approved company or suspending a rejected one.

---

## Database Changes

No new MongoDB indexes were added. The existing indexes from Modules 1–10 cover all Module 11 query patterns. The `admin/audit` route's switch from `audit_logs` (non-existent) to `company_audits` (indexed) is a correctness fix, not a new index.

---

## Observability Changes

Structured logging (`src/lib/logger.ts`) was already in place. Module 11 did not change the logger but did integrate it into the fixed admin routes via `handleAuthError` which calls `logger.error()` for unexpected server errors.

---

## CI/CD Changes

The existing `.github/workflows/ci.yml` was already correct (lint → typecheck → tests → build). No changes required.

---

## Remaining Warnings (Pre-Existing, Not Introduced by Module 11)

All diagnostics flagged by the language server in Module 11 files are **Tailwind CSS shorthand suggestions** from the tailwindcss linter plugin (e.g. `h-[300px]` → `h-75`). These are style suggestions, not TypeScript or ESLint errors. They exist throughout the pre-existing codebase and are consistent with the established project convention of using arbitrary values for precise sizing.

No Module 11 TypeScript errors remain.

---

## What Module 11 Did NOT Change

- `src/lib/firebase-admin.ts` — already correctly lazy-initialized
- `src/lib/logger.ts` — already structured JSON in prod, coloured in dev
- `src/lib/input-validation.ts` — already comprehensive
- `src/lib/rate-limit.ts` — already implemented with 4 pre-configured limiters
- `src/lib/api-errors.ts` — already standardized with trace IDs
- `src/lib/error-boundary.tsx` — already implemented with HOC
- `src/lib/env.ts` — already lazy server vars, safe build-time NEXT_PUBLIC_
- `next.config.ts` — already has HSTS, CSP, X-Frame-Options, all security headers
- `src/app/api/health/route.ts` — already performs real DB ping
- `.github/workflows/ci.yml` — already correct pipeline
- `.env.example` — already complete with all variables documented
- `store.tsx` derived state (`activeShipments`, etc.) — already memoized with `useMemo`
