# Frequently Asked Questions

**Related:** [Security](security.md) · [Architecture](architecture.md) · [Deployment](deployment.md) · [AI Engine](ai-engine.md) · [Back to README](../README.md)

---

**Q: How is tenant isolation enforced?**

`companyId` is resolved exclusively from the authenticated user's `UserRecord` in MongoDB -never from request body, query parameters, or headers. Every database query in multi-tenant collections prepends `{ companyId }` as the first filter condition.

---

**Q: What happens if Gemini is unavailable?**

The API retries once after 30 seconds on HTTP 429. On any other failure, or on double 429, it uses the fallback string `"AI explanation unavailable. Showing system-generated reasoning."` and continues creating the shipment. Gemini availability does not block shipment creation.

---

**Q: Why is the Risk Engine deterministic?**

Risk scores are stored on shipment records and referenced in audit logs. If the score were non-deterministic, an audit reviewer could not reproduce it. The formula uses only five inputs, all of which are persisted on the shipment document.

---

**Q: Can the socket server run on Vercel?**

No. Vercel runs API routes as ephemeral serverless functions with no persistent connections. Set `NEXT_PUBLIC_ENABLE_WEBSOCKET` to empty or unset, and the client will automatically fall back to 30-second polling for operational data freshness.

---

**Q: How does driver–vehicle assignment atomicity work?**

The assignment and unassignment operations open a MongoDB client session and run both writes (`drivers` collection and `vehicles` collection) inside `withTransaction()`. If either write fails, the transaction rolls back and neither document is modified.

---

**Q: What does the Shipment Pass contain?**

The Shipment Pass captures the route decision: selected route label, risk score, risk level, ETA, distance, dispatch time, and a SHA-256 hash of the core decision fields. The hash is computed at dispatch time and stored on the shipment. Any modification to the route fields after dispatch would produce a different hash, making tampering detectable.

---

**Q: How many roles does the platform support?**

Seven: `company_admin`, `super_admin`, `company_manager`, `operations_manager`, `fleet_manager`, `dispatcher`, and `driver`. Each role has a defined permission set enforced by `requireWorkforceRead`, `requireWorkforceWrite`, `requireUserMgmt`, and `requireCompanyAdmin` helpers.

---

**Q: Are company documents stored securely?**

Documents are stored as Base64-encoded strings in the `company_documents` MongoDB collection. Sensitive fields (Aadhaar numbers on driver records) are encrypted at rest using AES-256-GCM with a key from `DATA_ENCRYPTION_KEY`.

---

**Q: How are upcoming expiry warnings computed?**

The `ExpiryBadge` component uses `differenceInCalendarDays(parseISO(expiry), startOfToday())` from `date-fns`. A value ≤ 30 triggers the warning state. This applies to driver licence expiry and vehicle insurance, permit, and fitness expiry.

---

**Q: Can Super Admin modify company workforce data?**

Super Admin has read access across all companies for workforce data. Mutating operations (POST, PATCH, DELETE) to `/api/workforce/*` return HTTP 403 for Super Admin. Super Admin can approve, reject, suspend, and reactivate companies through the `/api/admin/companies` endpoints.

---

**Q: How does the polling fallback work?**

When `NEXT_PUBLIC_ENABLE_WEBSOCKET` is not `"true"`, the store sets a `setInterval` for 30 seconds that calls `fetchShipments()` and `fetchOperationalData()`. The interval is cleared when the component unmounts or the user logs out.

---

**Q: Is there a rate limit on Gemini calls?**

The application enforces a maximum of two Gemini calls per shipment creation (one initial attempt plus one retry on 429). There is no additional application-level rate limiting beyond this constraint.

---

**Q: How are immutable audit records enforced?**

The application layer provides no API endpoint that updates or deletes records in `company_audits` or `workforce_audits`. `createWorkforceAuditEvent` only calls `insertOne`. The audit helper wraps the insert in try/catch and logs failures but never re-throws -audit write failures never break the primary operation.

---

**Q: What happens on a 401 from an API route?**

The `fetchWithAuth` wrapper force-refreshes the Firebase ID token using `user.getIdToken(true)` and retries the request once with the fresh token. If the retry also returns 401, `handleAuthFailure` is called, which signs out the user and clears the shipment state.

---

**Q: Is the festival data included in the repository?**

The festival calendar is seeded into MongoDB via `scripts/seed-festivals.ts`. It is not shipped as static data in the codebase. The seed script must be run once against a MongoDB instance to populate the `festivals` collection.

---

**Q: Does the platform support multiple languages?**

The multilingual foundation is in place: `preferredLanguage` and `supportedLanguages` on company records, `preferredLanguage` on user records, and a `useI18nCompany` hook that syncs the UI locale from these settings. Translation string management and locale-specific formatting are planned for a future module.

---

**Q: How is the operational health score computed?**

The `OperationalHealthScore` aggregates six sub-components from live MongoDB queries: active shipment count, average risk score across active shipments, driver availability ratio, vehicle availability ratio, incident density, and route confidence. The composite score maps to five tiers: Excellent (80–100), Good (60–79), Fair (40–59), Poor (20–39), Critical (0–19).
