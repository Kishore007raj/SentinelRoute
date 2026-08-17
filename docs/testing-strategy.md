# SentinelRoute — Testing Strategy

> Module 11 Engineering Hardening  
> Last updated: 2026

---

## Overview

This document describes SentinelRoute's testing approach across all layers.  
Tests are run with **Vitest** (`npm test` / `npm run test:watch`).  
The test runner is configured in `vitest.config.mts` with the `happy-dom` environment.

---

## Test Commands

```bash
# Run all tests once (CI)
npm test

# Watch mode (development)
npm run test:watch

# TypeScript check (no compile)
node node_modules/typescript/bin/tsc --noEmit

# Lint
npm run lint
```

---

## Implemented Tests

### Location: `src/__tests__/`

| File | Type | Coverage |
|------|------|----------|
| `bug-condition-exploration.test.ts` | Property-based + unit | Document upload bug (Firebase Storage vs FileReader), PBT over all valid file sizes/types |
| `preservation-property.test.ts` | Property-based + unit | GET documents isolation, upsert semantics, admin RBAC 403, client-side file validation |

### Test Setup

`src/__tests__/setup.ts` — global test setup (mocks, environment initialization)

### Libraries Used

| Library | Purpose |
|---------|---------|
| `vitest ^4.1.9` | Test runner + assertions |
| `fast-check ^4.8.0` | Property-based testing (PBT) |
| `happy-dom ^20.10.3` | DOM environment for component tests |
| `@testing-library/react ^16.3.2` | React component testing |
| `@testing-library/jest-dom ^6.9.1` | Custom DOM assertions |
| `@testing-library/user-event ^14.6.1` | User interaction simulation |
| `mongodb-memory-server ^10.4.3` | In-memory MongoDB for integration tests |

---

## Testing Layers

### 1. Unit Tests — Implemented ✅

**What is tested:**
- Document upload logic (Firebase Storage removal, FileReader path)
- Client-side file validation (size guard, MIME type guard)
- API route validation logic (inline simulation)
- RBAC role checks (inline simulation)
- Upsert semantics for document storage

**Approach:** Logic is extracted from components/routes into testable helper functions or simulated inline. React rendering is not required for logic tests.

### 2. Property-Based Tests — Implemented ✅

**What is tested:**
- `for any valid PDF file (1B–10MB), fixed handleFile calls fetch` — 10 runs
- `for any valid DocumentType and file size, GET returns all stored fields` — 50 runs
- `for 1–5 sequential uploads of the same type, exactly one record per (companyId, type) exists` — 40 runs
- `any non-super_admin role always gets HTTP 403` — 50 runs
- `any file >10MB triggers toast error before storage call` — 30 runs
- `any MIME type not in allowlist triggers toast error` — 40 runs

---

## Testing Gaps — Honestly Documented

The following test types are **not yet implemented**. They are documented here as a backlog for future work.

### 3. Integration Tests — Not Implemented

**What would be tested:**
- Full API route: auth → validation → rate limit → DB → audit → response
- MongoDB index usage verification
- createAuditEvent writes correct schema to `company_audits`
- requireSuperAdmin correctly rejects non-admin tokens
- Analytics KPI engine returns correct values against real data

**Blocker:** Integration tests require either a running MongoDB instance or `mongodb-memory-server` setup with schema fixtures. The infrastructure exists (`mongodb-memory-server` is installed) but test fixtures have not been written.

**Recommendation:** Wire `mongodb-memory-server` into a `vitest.setup.ts` global and add at minimum:
- `POST /api/shipments` — creates shipment + writes audit
- `GET /api/analytics/kpis` — returns real KPIs from fixture data

### 4. API Tests (HTTP Layer) — Not Implemented

**What would be tested:**
- Every API route: authenticated request returns 200
- Unauthenticated request returns 401
- Wrong role returns 403
- Invalid pagination (page=0, limit=10000) is clamped
- Invalid sort field is rejected
- Cross-tenant companyId in body is ignored (server resolves from auth)

**Recommendation:** Use `vitest` + Next.js route handler testing or a lightweight HTTP test harness.

### 5. Authentication / RBAC Tests — Partially Implemented

**Implemented (unit/simulation):**
- super_admin role gate on admin API — covered in preservation tests
- Non-admin roles (5 roles) all return 403 — covered

**Not implemented:**
- Real Firebase token verification test (requires live Firebase project or Admin SDK stub)
- Token expiry handling
- Token refresh flow in StoreProvider

### 6. Tenant Isolation Tests — Not Implemented

**What would be tested:**
- Company A cannot read Company B's shipments
- Company A cannot read Company B's audit logs
- Analytics KPIs return zero for a company with no data, not another company's data
- Socket.IO: forged companyId in `join:company` is rejected by server middleware

### 7. Socket.IO Tests — Not Implemented

**What would be tested:**
- Socket authentication middleware rejects missing token
- Socket authentication middleware rejects invalid Firebase token
- `join:company` with mismatched companyId is rejected
- `join:entity` for a shipment belonging to another company is rejected
- Presence events are isolated to the correct company room
- Disconnect cleanup removes presence entry

**Blocker:** Socket.IO server runs inside the custom `server.ts` — needs a test harness that starts it on a random port.

### 8. Analytics Tests — Not Implemented

**What would be tested:**
- `KPIEngine.getShipmentKPIs` returns correct counts from fixture data
- `TrendEngine.getTrendData` returns correctly bucketed time series
- `ReportEngine.generateReportData` writes to `analytics_reports` and fires audit
- Export functions produce non-empty output for valid input

### 9. Load Tests — Not Implemented

**Recommendation:** Use `k6` or `autocannon` for:
- 100 concurrent `/api/shipments` GET requests — should not hit rate limit
- Rate limiter correctly blocks after 120 requests in 60s
- Socket.IO handles 50 concurrent connections

### 10. End-to-End Tests — Not Implemented

**Recommendation:** Use Playwright for:
- Sign in → dashboard renders
- Create shipment → appears in shipments list
- Platform admin: tenant management CRUD
- Analytics: KPI cards load real data

### 11. Accessibility Tests — Not Implemented

**Recommendation:** `axe-core` via `@axe-core/playwright` for:
- All navigation items have accessible names
- Dialogs trap focus correctly
- Form fields have labels
- Color contrast on status badges

---

## CI/CD Integration

Tests run in `.github/workflows/ci.yml`:

```
Install → TypeScript → ESLint → Tests → Build
```

The `test` job runs `npm run test` (= `vitest run` — no watch mode).  
Tests must pass before the build job runs.

---

## Known Limitations

1. `src/__tests__` is excluded from `tsconfig.json` to prevent test utilities from being included in the production build. Tests are type-checked by Vitest's own TypeScript resolution.

2. Property-based tests use fixed seeds (42, 100, 200, etc.) for reproducibility in CI. Increase `numRuns` locally to improve coverage confidence.

3. Component tests using `@testing-library/react` are not yet written. The testing library is installed and ready.

4. `mongodb-memory-server` is installed but no integration test fixtures exist yet.
