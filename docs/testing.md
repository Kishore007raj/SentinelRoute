# Testing

**Related:** [Development](development.md) · [Contributing](contributing.md) · [Architecture](architecture.md) · [Back to README](../README.md)

---

## Test Framework

SentinelRoute uses [Vitest](https://vitest.dev) with [fast-check](https://fast-check.io) for property-based testing and [`@testing-library/react`](https://testing-library.com/docs/react-testing-library/intro/) for component tests.

```bash
npm test           # Single run
npm run test:watch # Watch mode
```

---

## Property-Based Tests

The codebase includes a suite of correctness properties (P1–P12) that must hold at all times.

### P1 -Shipment ID Format
Every `shipmentId` stored in MongoDB matches the regex `/^SR-\d{4}$/`.

### P2 -Shipment ID Uniqueness
No two documents in the `shipments` collection share the same `shipmentId`.

### P3 -Risk Score Determinism
For any fixed `(distanceKm, durationHours, weatherFactor, deadline, cargoType)` tuple, `computeRisk` always returns the same `riskScore` and `riskLevel`.

### P4 -Risk Level Boundaries
- `riskScore ∈ (0, 10]` → `riskLevel === "Low"`
- `riskScore ∈ (10, 20]` → `riskLevel === "Medium"`
- `riskScore > 20` → `riskLevel === "High"`

### P5 -Weather Factor Bounds
`weatherFactor` is always in the range `[0, 5]` (minimum: all Clear; maximum: all Thunderstorm).

### P6 -Weather Sampling Count
`sampleRouteWeather` always samples exactly 5 points regardless of geometry length (or all points if fewer than 5 exist).

### P7 -Gemini Call Count
For any single `POST /api/shipments` request, the Gemini API is called at most twice (one initial attempt + one retry).

### P8 -MongoDB Write Before Response
The HTTP response for `POST /api/shipments` is never returned before the MongoDB write operation completes.

### P9 -Socket Emit After Write
`emitShipmentCreated` and `emitShipmentUpdated` are never called before the corresponding MongoDB write is confirmed.

### P10 -No Firestore or Google Maps Imports
The compiled module graph contains no import of `firebase/firestore`, `@vis.gl/react-google-maps`, or `@googlemaps/js-api-loader`.

### P11 -Zod Validation Before Processing
Any request body that fails Zod validation results in HTTP 400 and zero calls to OSRM, OpenWeather, Gemini, or MongoDB.

### P12 -API Response Envelope
Every API response body has exactly one of `{ success: true, data: ... }` or `{ success: false, error: string }`.

---

## Workforce Property Tests

Additional property-based tests cover the workforce module:

- **P -Company isolation:** records for company A return zero results when queried as company B
- **P -Driver round-trip consistency:** insert driver → fetch by `driverId+companyId` → all fields identical
- **P -Vehicle round-trip consistency:** insert vehicle → fetch by `vehicleId+companyId` → all fields identical
- **P -Assignment bidirectional consistency:** after assignment, `driver.assignedVehicleId === vehicleId` AND `vehicle.currentDriverId === driverId`
- **P -Suspension cascade completeness:** after suspending assigned driver, both `assignedVehicleId` and `currentDriverId` are null, vehicle status is `"available"`
- **P -Soft delete preserves records:** DELETE sets status to `"inactive"`, record still exists
- **P -Required-field validation:** missing `fullName`, `phone`, `licenseNumber`, or `licenseExpiry` returns HTTP 400
- **P -Audit for all events:** each workforce event type produces exactly one `workforce_audits` record with correct fields
- **P -Audit failure does not fail primary operation:** mock `createWorkforceAuditEvent` throws → primary write still returns 200/201
- **P -Self-modification guard:** PATCH to own userId always returns HTTP 403
- **P -Super Admin mutation block:** any POST/PATCH/DELETE to `/api/workforce/*` as `super_admin` returns HTTP 403
- **P -ExpiryBadge threshold:** badge mode shows warning iff `daysUntil <= 30` (including expired dates)
- **P -ExpiryIndicator color classification:** red / amber / green zones are mutually exclusive and exhaustive

---

## Test Location

```
src/__tests__/
├── workforce/
│   ├── driver.property.test.ts
│   ├── vehicle.property.test.ts
│   ├── assignment.property.test.ts
│   ├── dashboard.property.test.ts
│   ├── user-mgmt.property.test.ts
│   ├── audit.property.test.ts
│   ├── isolation.property.test.ts
│   ├── super-admin.property.test.ts
│   ├── access-control.test.ts
│   └── expiry-badge.property.test.ts
```

---

## Dependencies

| Package | Role |
|---|---|
| `vitest` | Test runner (Vite-native) |
| `fast-check` | Property-based testing |
| `mongodb-memory-server` | In-memory MongoDB for isolated tests |
| `@testing-library/react` | React component testing |
| `@testing-library/jest-dom` | DOM assertion matchers |
| `happy-dom` | DOM environment for Vitest |
