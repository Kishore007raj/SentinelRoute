# Security Architecture

Security is applied at every layer -from identity to data storage to transport.

**Related:** [Authentication](authentication.md) · [Database](database.md) · [API Reference](api-reference.md) · [Production Hardening](production-hardening.md) · [Deployment](deployment.md) · [Back to README](../README.md)

---

## Identity & Authentication

- Firebase Authentication is the sole identity provider. The `onAuthStateChanged` listener blocks all protected UI until the auth state resolves.
- Every API route verifies the Firebase ID token from the `Authorization: Bearer <token>` header using the Firebase Admin SDK.
- On 401, the client-side store force-refreshes the token and retries once. On second 401, the user is signed out.

See [authentication.md](authentication.md) for the full Firebase Auth flow.

---

## Role-Based Access Control

Seven roles are defined: `company_admin`, `super_admin`, `company_manager`, `operations_manager`, `fleet_manager`, `dispatcher`, `driver`. Role is stored server-side in the `UserRecord` MongoDB document and never derived from client input.

Role matrix enforcement is handled by `requireWorkforceRead`, `requireWorkforceWrite`, and `requireUserMgmt` helpers in `src/lib/auth-helpers.ts`.

| Role | Workforce Read | Workforce Write | User Management | Admin |
|---|:---:|:---:|:---:|:---:|
| `company_admin` | Yes | Yes | Yes | No |
| `company_manager` | Yes | Yes | Yes | No |
| `fleet_manager` | Yes | Yes | No | No |
| `operations_manager` | Yes | No | No | No |
| `dispatcher` | Yes | No | No | No |
| `driver` | Own record only | No | No | No |
| `super_admin` | Read-all | No | No | Yes |

---

## Tenant Isolation

`companyId` is resolved exclusively from the authenticated user's `UserRecord`. No API route accepts `companyId` from the request body or query parameters. Every MongoDB query in multi-tenant collections filters by `companyId`.

Cross-company leakage at the transport layer is structurally impossible -Socket.io company rooms are joined using the server-side `companyId`, not client-provided values.

---

## IDOR Protection

Driver and vehicle detail endpoints verify that the fetched document's `companyId` matches the requesting user's `companyId`. Mismatches return HTTP 403 with the message `"Access denied: resource belongs to a different company."`. Cross-company resource access is structurally blocked.

---

## Field-Level Encryption

`aadhaarNumber` on `Driver` records is encrypted at rest using AES-256-GCM before MongoDB storage. The encryption key is read from `DATA_ENCRYPTION_KEY` (a 32-byte base64 value). Non-manager roles receive the value masked as `"****"` in API responses.

---

## Input Validation

Zod schemas validate every inbound API payload before any downstream logic executes. Validation failures return HTTP 400 with field-level error messages. OSRM, OpenWeather, Gemini, and MongoDB are never called when validation fails.

---

## Integrity Hashing

The Shipment Pass includes a SHA-256 hash of the route decision data computed at dispatch time. The hash is tamper-evident by design. Any modification to the route fields after dispatch would produce a different hash.

---

## Audit Logging

`CompanyAudit` and `WorkforceAudit` records are insert-only. No API endpoint updates or deletes audit records. The `workforce_audits` collection has no update or delete paths anywhere in the codebase. `createWorkforceAuditEvent` wraps the insert in try/catch and logs failures but never re-throws -audit write failures never break the primary operation.

---

## MongoDB Index Security

All collections have compound indexes that enforce uniqueness (`shipmentId`, `driverId`, `vehicleId`, `auditId`) and support tenant-scoped queries (`companyId` prefix on all workforce indexes). This prevents accidental cross-tenant data leakage from partial queries.

---

## Enterprise Features Matrix

| Capability | SentinelRoute | Traditional TMS | Basic GPS Platform | Manual Dispatch |
|---|:---:|:---:|:---:|:---:|
| Multi-route generation | Yes | Rarely | No | No |
| AI-powered explanations | Yes | No | No | No |
| Real-time risk scoring | Yes | No | No | No |
| Weather corridor sampling | Yes | No | No | No |
| Predictive ETA | Yes | Limited | No | No |
| Multi-tenant isolation | Yes | Varies | No | N/A |
| Role-based access control | Yes (7 roles) | Limited | No | No |
| Immutable audit log | Yes | Sometimes | No | No |
| Driver/vehicle lifecycle | Yes | Sometimes | No | No |
| Assignment atomicity | Yes | No | No | No |
| Recommendation engine | Yes | No | No | No |
| Recommendation lifecycle | Yes | No | No | No |
| Incident management | Yes | Sometimes | No | No |
| Corridor intelligence | Yes | No | No | No |
| Heatmap visualization | Yes | No | Limited | No |
| Live presence tracking | Yes | No | No | No |
| Shipment communication | Yes | Sometimes | No | No |
| Executive analytics | Yes | Sometimes | No | No |
| PDF/XLSX export | Yes | Sometimes | No | No |
| Document verification | Yes | Sometimes | No | No |
| Field-level encryption | Yes | Varies | No | No |
| Socket.io real-time | Yes | No | No | No |
| Graceful degradation | Yes | Varies | No | N/A |
| Serverless compatible | Yes | No | Varies | N/A |
