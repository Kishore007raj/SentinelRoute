# Tasks

## Task List

- [x] 1. Foundation — types, MongoDB client, Zod schemas, and indexes
  - [x] 1.1 Rebuild `src/lib/types.ts` — replace all existing types with the new `Shipment` interface that mirrors the MongoDB document (fields: `_id`, `shipmentId`, `origin`, `destination`, `status`, `deadline`, `distanceKm`, `durationHours`, `riskScore`, `riskLevel`, `aiExplanation`, `createdAt`, `updatedAt`); remove all legacy type definitions
  - [x] 1.2 Create `src/lib/mongodb.ts` — singleton `MongoClient` with `getDb()` and `getShipmentsCollection()` helpers; include `ensureIndexes()` that creates the unique index on `shipmentId`, descending index on `createdAt`, and standard index on `status`
  - [x] 1.3 Create `src/lib/schemas.ts` — define `CreateShipmentSchema` (origin, destination, deadline, cargoType) and `UpdateShipmentSchema` (status enum) using Zod; export inferred types `CreateShipmentInput` and `UpdateShipmentInput`

- [x] 2. Core lib modules — OSRM, WeatherSampler, RiskEngine, Gemini
  - [x] 2.1 Create `src/lib/osrm.ts` — `getRoute(origin, destination)` that calls OSRM with `?overview=full&geometries=geojson`, extracts `distanceKm`, `durationHours`, and `geometry`; returns `null` when `routes` is empty or the fetch fails
  - [x] 2.2 Rebuild `src/lib/weather.ts` — `sampleRouteWeather(geometry)` that selects exactly 5 evenly spaced indices from the coordinate array, fetches OpenWeather current weather for each point in parallel, maps condition strings to scores (`Clear`→0, `Clouds`→1, `Rain`→3, `Thunderstorm`→5, unknown→1), returns the arithmetic mean; individual failures fall back to score 1
  - [x] 2.3 Rebuild `src/lib/risk.ts` — `computeRisk(input: RiskInput): RiskResult` implementing the deterministic formula: `distanceFactor + durationFactor + weatherFactor + urgencyFactor + cargoFactor`; urgency thresholds at <24 h (5), 24–72 h (3), ≥72 h (1); cargo fragile→4 else 1; level boundaries ≤10 Low, ≤20 Medium, >20 High
  - [x] 2.4 Rebuild `src/lib/gemini.ts` — `generateExplanation(input: GeminiInput): Promise<string>` that calls Gemini once, retries exactly once after 30 s on HTTP 429, and returns the fallback string `"AI explanation unavailable. Showing system-generated reasoning."` on any double failure; `callGemini` helper returns `null` on 429 to signal retry

- [-] 3. Socket.io server and client
  - [x] 3.1 Create `src/lib/socket-server.ts` — `getSocketServer()` singleton that initialises `Server` once per process with `path: "/api/socket"`; export `emitShipmentCreated(shipment)` and `emitShipmentUpdated(shipment)` helpers
  - [ ] 3.2 Create `src/lib/socket-client.ts` — `useSocket(onCreated, onUpdated)` React hook that creates a single `socket.io-client` instance with `reconnection: true` and `path: "/api/socket"`, registers event listeners on mount, and removes them on unmount
  - [ ] 3.3 Create `src/app/api/socket/route.ts` — Next.js route handler that upgrades the HTTP connection to a Socket.io connection by attaching `getSocketServer()` to the underlying Node.js HTTP server

- [ ] 4. API routes — POST, GET, PATCH shipments
  - [ ] 4.1 Rebuild `src/app/api/shipments/route.ts` — implement `POST /api/shipments` following the strict 11-step pipeline: (1) parse body, (2) Zod validate → 400, (3) verify Firebase Auth token → 401, (4) generate unique `shipmentId` via uniqueness loop, (5) call `getRoute` → 422 if null, (6) call `sampleRouteWeather`, (7) call `computeRisk`, (8) call `generateExplanation`, (9) write to MongoDB → 500 on failure, (10) call `emitShipmentCreated`, (11) return 201 `{ success: true, data: shipment }`; call `ensureIndexes()` on first request
  - [ ] 4.2 Add `GET /api/shipments` handler to `src/app/api/shipments/route.ts` — verify Firebase Auth token → 401, query MongoDB `find({}).sort({ createdAt: -1 })`, return 200 `{ success: true, data: [...shipments] }`
  - [ ] 4.3 Create `src/app/api/shipments/[id]/route.ts` — implement `PATCH /api/shipments/:id`: (1) Zod validate body → 400, (2) verify Firebase Auth token → 401, (3) `findOneAndUpdate` with `returnDocument: "after"` → 404 if not found, (4) call `emitShipmentUpdated`, (5) return 200 `{ success: true, data: updated }`; set `updatedAt` to current server timestamp on every update

- [ ] 5. Firebase cleanup — remove Firestore from `firebase.ts`
  - [ ] 5.1 Modify `src/lib/firebase.ts` — remove `getFirestore` import, remove `db` export, and remove any Firestore initialisation; keep only `initializeApp`/`getApp`/`getApps` and `getAuth`/`auth` export
  - [ ] 5.2 Verify `src/lib/auth-context.tsx` contains no Firestore imports and no references to the removed `db` export; fix any broken imports

- [ ] 6. Store rebuild
  - [ ] 6.1 Rebuild `src/lib/store.tsx` — replace existing store with a `useReducer`-based `StoreContext` that handles actions `SET_SHIPMENTS`, `SET_LOADING`, `ADD_SHIPMENT` (prepend), and `UPDATE_SHIPMENT` (replace by `_id`); expose `shipments`, `loading`, and `refreshShipments()` (fetches from `GET /api/shipments`); wire `useSocket` so `shipment_created` dispatches `ADD_SHIPMENT` and `shipment_updated` dispatches `UPDATE_SHIPMENT` — no optimistic updates, no local-only fallback paths

- [ ] 7. Frontend pages rebuild
  - [ ] 7.1 Rebuild `src/app/(app)/dashboard/page.tsx` — read `shipments` and `loading` from `StoreContext`; derive KPI values (total, in-transit count, high-risk count, average risk score) from the live store data; render `KPICard` components; no hardcoded or mock data
  - [ ] 7.2 Rebuild `src/app/(app)/shipments/page.tsx` — read `shipments` and `loading` from `StoreContext`; render a list of shipment rows (using `ShipmentFeedRow` or equivalent); show a loading skeleton while `loading` is true; no hardcoded data
  - [ ] 7.3 Rebuild `src/app/(app)/shipments/[shipmentId]/page.tsx` — fetch the individual shipment from `StoreContext` by matching `shipmentId` param; display all shipment fields including `riskScore`, `riskLevel`, `aiExplanation`, `distanceKm`, `durationHours`; provide a status-update control that calls `PATCH /api/shipments/:id` and relies on the resulting `shipment_updated` socket event to refresh the UI
  - [ ] 7.4 Rebuild `src/app/(app)/create-shipment/page.tsx` — form with fields for `origin.lat`, `origin.lng`, `destination.lat`, `destination.lng`, `deadline`, and `cargoType`; on submit call `POST /api/shipments`; on success clear all form fields; do not add the new shipment to local state directly — wait for the `shipment_created` socket event
  - [ ] 7.5 Update `src/app/(app)/layout.tsx` — ensure `StoreProvider` and `SocketClient` initialisation are present; auth guard blocks render until `onAuthStateChanged` has fired; redirect unauthenticated users to `/auth/signin`
  - [ ] 7.6 Update `src/app/layout.tsx` — ensure root layout wraps the app with `UserProvider` (Firebase Auth context); no Firestore provider

- [ ] 8. Delete legacy files
  - [ ] 8.1 Delete `src/lib/firestore.ts` — remove the file entirely after confirming no remaining imports reference it
  - [ ] 8.2 Delete `src/lib/google-maps.ts` — remove the file entirely after confirming no remaining imports reference it
  - [ ] 8.3 Delete `src/lib/route-builder.ts` — remove the file entirely after confirming no remaining imports reference it
  - [ ] 8.4 Delete `src/lib/mock-data.ts` — remove the file entirely after confirming no remaining imports reference it
  - [ ] 8.5 Delete `src/app/api/analyze-routes/` directory and all files within it — remove the entire folder after confirming no remaining imports reference it
  - [ ] 8.6 Audit all remaining source files for any residual imports of `firebase/firestore`, `@vis.gl/react-google-maps`, `@googlemaps/js-api-loader`, or the deleted lib files; remove or replace every such import

- [ ] 9. Property-based tests for P1–P12
  - [ ] 9.1 Write property test for P1 — `shipmentId` format: for any generated ID the value matches `/^SR-\d{4}$/` **Validates: Requirement 2.1**
  - [ ] 9.2 Write property test for P2 — `shipmentId` uniqueness: running the uniqueness-loop generator N times never produces a duplicate within the same run **Validates: Requirement 2.2–2.4**
  - [ ] 9.3 Write property test for P3 — risk score determinism: for any arbitrary `(distanceKm, durationHours, weatherFactor, deadline, cargoType)` tuple, calling `computeRisk` twice returns identical `riskScore` and `riskLevel` **Validates: Requirement 8.1, 8.13**
  - [ ] 9.4 Write property test for P4 — risk level boundaries: for any `riskScore` value, the returned `riskLevel` is `"Low"` iff score ∈ (0,10], `"Medium"` iff score ∈ (10,20], `"High"` iff score > 20 **Validates: Requirement 8.10–8.12**
  - [ ] 9.5 Write property test for P5 — weather factor bounds: for any geometry with arbitrary weather conditions, `sampleRouteWeather` returns a value in `[0, 5]` **Validates: Requirement 7.4–7.5**
  - [ ] 9.6 Write property test for P6 — weather sampling count: for any geometry with ≥5 coordinates, `sampleRouteWeather` samples exactly 5 points; for geometries with <5 coordinates it samples all available points **Validates: Requirement 7.1**
  - [ ] 9.7 Write property test for P7 — Gemini call count: for any single invocation of `generateExplanation`, the underlying HTTP client is called at most twice **Validates: Requirement 9.2, 9.4**
  - [ ] 9.8 Write property test for P8 — MongoDB write before response: the HTTP 201 response from `POST /api/shipments` is never returned before the MongoDB write resolves **Validates: Requirement 1.5, 5.4**
  - [ ] 9.9 Write property test for P9 — socket emit after write: `emitShipmentCreated` and `emitShipmentUpdated` are never called before the corresponding MongoDB write is confirmed **Validates: Requirement 10.4**
  - [ ] 9.10 Write property test for P10 — no Firestore or Google Maps imports: static analysis of the compiled module graph confirms zero imports of `firebase/firestore`, `@vis.gl/react-google-maps`, or `@googlemaps/js-api-loader` **Validates: Requirement 15.1–15.2**
  - [ ] 9.11 Write property test for P11 — Zod validation before processing: for any request body that fails `CreateShipmentSchema` or `UpdateShipmentSchema`, the API returns HTTP 400 and makes zero calls to OSRM, OpenWeather, Gemini, or MongoDB **Validates: Requirement 3.2–3.3, 3.5**
  - [ ] 9.12 Write property test for P12 — API response envelope: for any response from `POST /api/shipments`, `GET /api/shipments`, or `PATCH /api/shipments/:id`, the body has exactly one of `{ success: true, data: ... }` or `{ success: false, error: string }` **Validates: Requirement 4.1–4.2**
