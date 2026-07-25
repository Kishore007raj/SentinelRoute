# Production Hardening

**Related:** [Deployment](deployment.md) · [Security](security.md) · [Performance](performance.md) · [Architecture](architecture.md) · [Back to README](../README.md)

---

## Logging

`src/lib/logger.ts` provides structured server-side logging. Every caught error in API routes is logged with operation context. Silent failures -catching an error without logging or surfacing it -are treated as a compliance violation in the codebase standards.

All caught errors include:
- The operation name (e.g., `[store] fetchShipments`, `[gemini] API error`)
- The HTTP status code or error message
- Sufficient context to identify the failing component

---

## Validation

Zod validates every inbound API payload before any downstream operation. Field-level error messages are returned to the caller. No manual field-presence checks are used as the primary validation mechanism.

Validation runs before token verification in some routes to avoid unnecessary auth overhead on obviously malformed payloads.

---

## Security

Firebase Admin token verification is applied at the start of every protected API handler. See [security.md](security.md) for the full security architecture.

---

## Graceful Degradation

| Failure | Behavior |
|---|---|
| Gemini unavailable | Falls back to `"AI explanation unavailable. Showing system-generated reasoning."` -shipment creation continues |
| OpenWeather call fails (individual point) | Falls back to weather score 1 -shipment creation continues |
| OSRM returns no route | Returns HTTP 422 -no partial shipment is created |
| MongoDB write failure | Returns HTTP 500 before any socket event is emitted |
| Socket.io unavailable | Client falls back to 30-second polling |
| Token expired | Client force-refreshes token and retries once before signing out |
| OSRM returns no geometry | Route analysis falls back to static route estimates |
| Operational feed unavailable | Returns empty array -no error surfaced to the client |
| Analytics data unavailable | Returns zero-value aggregations -no error |

---

## Error Handling

API routes follow a consistent `try/catch` pattern:
- Unhandled errors return `{ success: false, error: "<message>" }` with HTTP 500
- 4xx errors include specific, actionable error messages
- The `fetchWithResilience` helper retries once on network errors and 5xx with an 800ms delay
- `createWorkforceAuditEvent` wraps the audit insert in try/catch and logs failures but never re-throws -audit write failures never break the primary operation

---

## Type Safety

`tsconfig.json` uses `strict: true`. The `any` type is prohibited by convention throughout the codebase. All types are defined in `src/lib/types.ts` and imported by all consumers. No module defines local type aliases that duplicate centralized types.

---

## Retry Strategy

| Operation | Retry Behavior |
|---|---|
| Gemini | One retry after 30 seconds on HTTP 429. Maximum two total calls per shipment. |
| API fetch (`fetchWithResilience`) | One retry after 800ms on network errors and 5xx. No retry on 4xx. |
| Firebase token refresh | One force-refresh on 401. Sign out on second 401. |
| Socket.io | Automatic reconnection with re-join on reconnect. |
| MongoDB | Driver-level connection pool manages reconnection automatically. |

---

## Immutability Guarantees

- `company_audits` -insert-only, no update or delete API paths
- `workforce_audits` -insert-only, no update or delete API paths
- `shipment_timeline` -append-only, no update or delete API paths
- Soft-delete is used for drivers and vehicles (status → `"inactive"`) -records are never physically removed

---

## Health Checks

- `GET /api/health` -basic platform health check
- `GET /api/admin/health` -Super Admin platform health with connection status
