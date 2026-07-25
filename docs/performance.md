# Performance Characteristics

**Related:** [Architecture](architecture.md) · [Database](database.md) · [Real-Time](real-time.md) · [Production Hardening](production-hardening.md) · [Back to README](../README.md)

---

## Startup

The Next.js App Router is used exclusively. The custom Node.js server (`server.ts`) initializes the Socket.io server once per process. The MongoDB client is a singleton that reuses connections across hot reloads in development via a global variable guard.

---

## Latency

- **Route analysis** (`POST /api/analyze-routes`) runs OSRM routing and 5 parallel OpenWeather calls. Total latency depends on external API response times, typically 500ms–1500ms.
- **Shipment creation** (`POST /api/shipments`) runs the 11-step pipeline serially where steps must be sequential (validation, routing, weather, risk, Gemini, MongoDB write) but weather sampling runs 5 calls in parallel via `Promise.all`.
- **Gemini retry** waits 30 seconds on HTTP 429. This is the only blocking operation with a long wait; shipment creation is not blocked if Gemini fails on both attempts.

---

## Real-Time

Socket.io events are emitted after confirmed MongoDB writes. Clients receive `shipment:created` and `shipment:updated` events within milliseconds of the write completing. The `fetchWithAuth` wrapper has a 9-second hard timeout per attempt with a single retry on network errors and 5xx responses.

---

## Indexes

MongoDB indexes are created at server startup via `ensureIndexes()`. Key performance indexes:
- `shipments.createdAt` (descending) -default sort for GET all shipments
- `drivers.companyId + licenseExpiry` -upcoming expiry queries
- `workforce_audits.companyId + timestamp` (descending) -recent activity queries
- `executions.shipmentId` (unique) -single execution lookup

See [database.md](database.md) for the full index catalog.

---

## Memoization

Client-side KPI derivations in analytics pages use `useMemo` with `shipments` as the dependency. Store-derived collections (`activeShipments`, `completedShipments`, `atRiskShipments`) are memoized in the store provider to prevent recomputation on every render.

---

## Event Driven

The store does not poll for shipments when WebSocket is enabled. State updates flow exclusively through socket events (`shipment:created`, `shipment:updated`). Polling (30-second interval) is activated only when `NEXT_PUBLIC_ENABLE_WEBSOCKET` is not set.

---

## Caching

No stale client-side cache. `refreshShipments()` issues a fresh `GET /api/shipments` against MongoDB on demand. The store holds no TTL-based cache; the single source of truth is always MongoDB.

---

## Build

Standard `next build` output. The custom server is compiled with `tsx`. Static assets are served from `public/`.

---

## Scalability

The current architecture scales vertically on a single Node.js process for the WebSocket server. The MongoDB Atlas connection pool handles concurrent requests. The Vercel deployment target runs Next.js API routes as serverless functions with polling fallback for the absence of a persistent WebSocket server.

For horizontal scale-out, the Socket.io server can be replaced with a Redis-backed adapter, and the event emission layer can be replaced with a Kafka-based stream -see [roadmap.md](roadmap.md) for details.

---

## fetch Resilience

The `fetchWithResilience` helper in `src/lib/store.tsx` provides:
- Hard 9-second timeout per attempt via `AbortController`
- Single retry after 800ms on network errors and 5xx responses
- No retry on 4xx (except 401 which triggers token refresh)
- Each attempt gets its own `AbortController` to prevent timeout bleed-over
