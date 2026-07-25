# Observability

**Related:** [Production Hardening](production-hardening.md) · [Deployment](deployment.md) · [Architecture](architecture.md) · [Back to README](../README.md)

---

## Logging

`src/lib/logger.ts` provides structured server-side logging. Every caught error in API routes is logged with operation context before the response is returned.

**Logging conventions:**
- Prefix with the module name: `[store]`, `[gemini]`, `[socket]`, `[workforce]`
- Include the HTTP status code or error message
- Include enough context to identify the failing operation without reading the full stack trace
- Silent failures -catching an error without logging -are treated as a compliance violation

**Example log lines:**
```
[gemini] API error 429
[store] fetchShipments: API 503
[socket] Server initialised
[workforce] Driver suspension cascade failed: ...
```

---

## Health Checks

| Endpoint | Role | Auth |
|---|---|---|
| `GET /api/health` | Basic platform health | None |
| `GET /api/admin/health` | Platform health with DB connection status | `super_admin` |

---

## Platform Monitoring (Current)

In the current prototype deployment:
- Vercel provides request logs, function execution times, and error tracking through its dashboard.
- MongoDB Atlas provides collection-level query performance metrics and index usage reports.
- Firebase Console provides Authentication event logs and user management.

---

## Platform Monitoring (Future -Google Cloud)

When migrating to Google Cloud:

| Tool | Role |
|---|---|
| Cloud Logging | Structured log aggregation and querying |
| Cloud Monitoring | Metrics, alerting, and uptime checks |
| Error Reporting | Automatic error grouping and notifications |
| Cloud Trace | Distributed request tracing across API routes |

See [roadmap.md](roadmap.md) for the Google Cloud migration plan.

---

## Operational Health Score

The `OperationalHealthScore` at `GET /api/operational/health` serves as a functional health indicator for the platform's operational layer. It aggregates six sub-components:

- Active shipment count
- Average risk score across active shipments
- Driver availability ratio
- Vehicle availability ratio
- Incident density
- Route confidence

Score maps to: Excellent (80–100), Good (60–79), Fair (40–59), Poor (20–39), Critical (0–19).
