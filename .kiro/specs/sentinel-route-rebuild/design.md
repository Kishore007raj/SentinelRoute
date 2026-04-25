# Design Document

## Overview

SentinelRoute is rebuilt as a clean Next.js App Router application. All Firestore and Google Maps dependencies are removed. MongoDB is the sole data store. OSRM handles routing, OpenWeather provides weather data, Gemini generates AI explanations, Socket.io delivers real-time updates, and Firebase Auth handles identity. Zod validates every inbound API payload before any database write.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  AuthContext (Firebase Auth)  ←→  SocketClient (Socket.io)     │
│         ↓                                ↓                      │
│  StoreContext (useReducer)  ←── socket events (shipment_*)     │
│         ↓                                                       │
│  React Pages / Components                                       │
│         ↓ fetch()                                               │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                           │
│                                                                 │
│  POST /api/shipments   GET /api/shipments   PATCH /api/shipments/:id  │
│         ↓                    ↓                      ↓           │
│  Zod validation        MongoDB read          Zod validation     │
│  OSRM call             sort createdAt↓       MongoDB update     │
│  WeatherSampler                              Socket.io emit     │
│  RiskEngine                                                     │
│  Gemini (once)                                                  │
│  MongoDB write                                                  │
│  Socket.io emit                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                           │
│                                                                 │
│  MongoDB Atlas   OSRM   OpenWeather   Gemini   Firebase Auth   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### MongoDB Shipment Document

```typescript
interface ShipmentDocument {
  _id: ObjectId;
  shipmentId: string;                          // "SR-XXXX", unique index
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  status: "pending" | "in_transit" | "completed";
  deadline: Date;
  distanceKm: number;
  durationHours: number;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  aiExplanation: string;
  createdAt: Date;                             // descending index
  updatedAt: Date;
}
```

### MongoDB Indexes

| Field        | Type       | Purpose                          |
|--------------|------------|----------------------------------|
| `shipmentId` | unique     | ID uniqueness enforcement        |
| `createdAt`  | descending | Default sort for GET /api/shipments |
| `status`     | standard   | Status-based filtering           |

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── shipments/
│   │   │   ├── route.ts              # GET + POST
│   │   │   └── [id]/
│   │   │       └── route.ts          # PATCH
│   │   └── socket/
│   │       └── route.ts              # Socket.io upgrade handler
│   ├── (app)/
│   │   ├── layout.tsx                # Auth guard + app shell
│   │   ├── dashboard/page.tsx
│   │   ├── shipments/
│   │   │   ├── page.tsx
│   │   │   └── [shipmentId]/page.tsx
│   │   └── create-shipment/page.tsx
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   └── signup/page.tsx
│   └── layout.tsx                    # Root layout with providers
├── lib/
│   ├── types.ts                      # Shipment interface (rebuilt)
│   ├── mongodb.ts                    # MongoDB client singleton
│   ├── schemas.ts                    # Zod schemas
│   ├── osrm.ts                       # OSRM client
│   ├── weather.ts                    # WeatherSampler (rebuilt)
│   ├── risk.ts                       # RiskEngine (rebuilt)
│   ├── gemini.ts                     # Gemini client (rebuilt)
│   ├── socket-server.ts              # Socket.io server singleton
│   ├── socket-client.ts              # Socket.io client hook
│   ├── auth-context.tsx              # Firebase Auth context (kept)
│   ├── store.tsx                     # Client state (rebuilt)
│   └── firebase.ts                   # Firebase Auth only (Firestore removed)
└── components/
    ├── layout/
    │   ├── AppSidebar.tsx
    │   ├── AppHeader.tsx
    │   └── PageTransition.tsx
    ├── shipment/
    │   ├── ShipmentFeedRow.tsx
    │   ├── ShipmentCard.tsx
    │   └── CreateShipmentForm.tsx
    └── ui/                           # shadcn/ui (unchanged)
```

---

## Component Design

### `src/lib/types.ts` (rebuilt)

Replaces the existing types entirely. The new `Shipment` type mirrors the MongoDB document exactly.

```typescript
export interface Shipment {
  _id: string;                                 // ObjectId serialised as string
  shipmentId: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  status: "pending" | "in_transit" | "completed";
  deadline: string;                            // ISO string on the client
  distanceKm: number;
  durationHours: number;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  aiExplanation: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### `src/lib/mongodb.ts`

Singleton MongoDB client. Reuses the connection across hot-reloads in development.

```typescript
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
let client: MongoClient;
let db: Db;

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  db = client.db(process.env.MONGODB_DB_NAME ?? "sentinelroute");
  return db;
}

export async function getShipmentsCollection() {
  const database = await getDb();
  return database.collection<ShipmentDocument>("shipments");
}
```

Index creation runs once at startup via a separate `ensureIndexes()` call invoked from the API route on first request.

---

### `src/lib/schemas.ts`

All Zod schemas in one file.

```typescript
import { z } from "zod";

export const CreateShipmentSchema = z.object({
  origin: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  destination: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  deadline: z.string().datetime({ message: "deadline must be a valid ISO 8601 date string" }),
  cargoType: z.enum(["standard", "fragile"]).default("standard"),
});

export const UpdateShipmentSchema = z.object({
  status: z.enum(["pending", "in_transit", "completed"]),
});

export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof UpdateShipmentSchema>;
```

---

### `src/lib/osrm.ts`

OSRM routing client. Returns distance, duration, and route geometry.

```typescript
export interface OsrmRoute {
  distanceKm: number;
  durationHours: number;
  geometry: GeoJsonLineString;   // routes[0].geometry
}

export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<OsrmRoute | null> {
  const url = `${process.env.OSRM_BASE_URL}/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.routes?.length) return null;

  const route = data.routes[0];
  return {
    distanceKm:   route.distance / 1000,
    durationHours: route.duration / 3600,
    geometry:     route.geometry,
  };
}
```

---

### `src/lib/weather.ts` (rebuilt)

WeatherSampler: samples exactly 5 evenly spaced points from the OSRM geometry and fetches weather for each in parallel.

```typescript
const WEATHER_SCORES: Record<string, number> = {
  Clear:        0,
  Clouds:       1,
  Rain:         3,
  Thunderstorm: 5,
};

export async function sampleRouteWeather(
  geometry: GeoJsonLineString
): Promise<number> {
  const coords = geometry.coordinates;           // [lng, lat][]
  const indices = sampleIndices(coords.length, 5);
  const points = indices.map(i => coords[i]);

  const scores = await Promise.all(
    points.map(([lng, lat]) => fetchWeatherScore(lat, lng))
  );

  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

function sampleIndices(total: number, count: number): number[] {
  if (total <= count) return Array.from({ length: total }, (_, i) => i);
  return Array.from({ length: count }, (_, i) =>
    Math.round((i / (count - 1)) * (total - 1))
  );
}

async function fetchWeatherScore(lat: number, lng: number): Promise<number> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHER_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return 1;
    const data = await res.json();
    const condition: string = data.weather?.[0]?.main ?? "";
    return WEATHER_SCORES[condition] ?? 1;
  } catch {
    return 1;   // fallback score on failure
  }
}
```

---

### `src/lib/risk.ts` (rebuilt)

Deterministic RiskEngine. No randomness, no AI involvement.

```typescript
export interface RiskInput {
  distanceKm: number;
  durationHours: number;
  weatherFactor: number;
  deadline: Date;
  cargoType: string;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
}

export function computeRisk(input: RiskInput): RiskResult {
  const { distanceKm, durationHours, weatherFactor, deadline, cargoType } = input;

  const distanceFactor  = distanceKm * 0.02;
  const durationFactor  = durationHours * 0.5;
  const urgencyFactor   = computeUrgencyFactor(deadline);
  const cargoFactor     = cargoType === "fragile" ? 4 : 1;

  const riskScore =
    distanceFactor + durationFactor + weatherFactor + urgencyFactor + cargoFactor;

  const riskLevel: "Low" | "Medium" | "High" =
    riskScore <= 10 ? "Low" :
    riskScore <= 20 ? "Medium" : "High";

  return { riskScore, riskLevel };
}

function computeUrgencyFactor(deadline: Date): number {
  const hoursUntilDeadline = (deadline.getTime() - Date.now()) / 3_600_000;
  if (hoursUntilDeadline < 24)  return 5;
  if (hoursUntilDeadline < 72)  return 3;
  return 1;
}
```

---

### `src/lib/gemini.ts` (rebuilt)

Gemini client with exactly one call per shipment and one retry on HTTP 429.

```typescript
const FALLBACK = "AI explanation unavailable. Showing system-generated reasoning.";

export interface GeminiInput {
  distanceKm: number;
  durationHours: number;
  weatherFactor: number;
  riskScore: number;
  riskLevel: string;
  deadline: string;
}

export async function generateExplanation(input: GeminiInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return FALLBACK;

  const prompt = buildPrompt(input);

  const result = await callGemini(prompt, apiKey);
  if (result !== null) return result;

  // Single retry on 429
  await sleep(30_000);
  const retry = await callGemini(prompt, apiKey);
  return retry ?? FALLBACK;
}

async function callGemini(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
        }),
      }
    );

    if (res.status === 429) return null;   // signal retry
    if (!res.ok) {
      console.error(`[gemini] API error ${res.status}`);
      return FALLBACK;
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? FALLBACK;
  } catch (err) {
    console.error("[gemini] Fetch failed:", err);
    return FALLBACK;
  }
}

function buildPrompt(input: GeminiInput): string {
  return (
    `You are a logistics risk analyst. Summarise this shipment risk profile in 2–3 sentences.\n` +
    `Distance: ${input.distanceKm.toFixed(1)} km\n` +
    `Duration: ${input.durationHours.toFixed(2)} hours\n` +
    `Weather factor: ${input.weatherFactor.toFixed(2)}\n` +
    `Risk score: ${input.riskScore.toFixed(2)} (${input.riskLevel})\n` +
    `Deadline: ${input.deadline}`
  );
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
```

---

### `src/lib/socket-server.ts`

Socket.io server singleton. Initialised once per server process.

```typescript
import { Server } from "socket.io";

let io: Server | null = null;

export function getSocketServer(httpServer?: unknown): Server {
  if (io) return io;
  io = new Server(httpServer as any, {
    path: "/api/socket",
    cors: { origin: "*" },
  });
  console.log("[socket] Server initialised");
  return io;
}

export function emitShipmentCreated(shipment: unknown): void {
  getSocketServer().emit("shipment_created", shipment);
}

export function emitShipmentUpdated(shipment: unknown): void {
  getSocketServer().emit("shipment_updated", shipment);
}
```

---

### `src/lib/socket-client.ts`

Client-side Socket.io hook. Connects on mount, auto-reconnects, updates store state directly from events.

```typescript
"use client";
import { useEffect } from "react";
import { io, Socket } from "socket.io-client";
import type { Shipment } from "./types";

let socket: Socket | null = null;

export function useSocket(
  onCreated: (s: Shipment) => void,
  onUpdated: (s: Shipment) => void
): void {
  useEffect(() => {
    if (!socket) {
      socket = io({ path: "/api/socket", reconnection: true });
    }

    socket.on("shipment_created", onCreated);
    socket.on("shipment_updated", onUpdated);

    return () => {
      socket?.off("shipment_created", onCreated);
      socket?.off("shipment_updated", onUpdated);
    };
  }, [onCreated, onUpdated]);
}
```

---

### `src/lib/store.tsx` (rebuilt)

Client state using `useReducer`. Fetches from API on load. Updates state from socket events only — no optimistic updates.

```typescript
type Action =
  | { type: "SET_SHIPMENTS"; payload: Shipment[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "ADD_SHIPMENT"; payload: Shipment }
  | { type: "UPDATE_SHIPMENT"; payload: Shipment };

// ADD_SHIPMENT: prepend to list (from socket shipment_created)
// UPDATE_SHIPMENT: replace matching _id (from socket shipment_updated)
```

The store exposes:
- `shipments: Shipment[]`
- `loading: boolean`
- `refreshShipments(): Promise<void>`

No `dispatchShipment` or local-only fallback paths. All mutations go through the API.

---

### `src/lib/firebase.ts` (modified)

Firestore import and `db` export are removed. Only `auth` is exported.

```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// No getFirestore import
```

---

## API Route Design

### `POST /api/shipments`

**Pipeline (strict order):**

1. Parse request body
2. Validate with `CreateShipmentSchema` → 400 on failure
3. Verify Firebase Auth token → 401 on failure
4. Generate `shipmentId` via uniqueness loop
5. Call `getRoute(origin, destination)` → 422 if no route
6. Call `sampleRouteWeather(geometry)` → 5 parallel OpenWeather calls
7. Call `computeRisk({ distanceKm, durationHours, weatherFactor, deadline, cargoType })`
8. Call `generateExplanation(...)` — exactly once, with one retry on 429
9. Build full `ShipmentDocument`, write to MongoDB → 500 on failure
10. Call `emitShipmentCreated(shipment)`
11. Return `{ success: true, data: shipment }` with HTTP 201

**Response shape:**
```json
{
  "success": true,
  "data": { ...ShipmentDocument }
}
```

---

### `GET /api/shipments`

1. Verify Firebase Auth token → 401 on failure
2. Query MongoDB: `find({}).sort({ createdAt: -1 })`
3. Return `{ success: true, data: [...shipments] }` with HTTP 200

---

### `PATCH /api/shipments/:id`

1. Validate body with `UpdateShipmentSchema` → 400 on failure
2. Verify Firebase Auth token → 401 on failure
3. `findOneAndUpdate({ _id: id }, { $set: { status, updatedAt: new Date() } }, { returnDocument: "after" })` → 404 if not found
4. Call `emitShipmentUpdated(updated)`
5. Return `{ success: true, data: updated }` with HTTP 200

---

## Authentication Flow

Firebase Auth is the sole identity provider. The `UserProvider` wraps the entire app and subscribes to `onAuthStateChanged`. The `(app)/layout.tsx` auth guard blocks rendering until `loading` is false, then redirects unauthenticated users to `/auth/signin`.

API routes verify the Firebase ID token from the `Authorization: Bearer <token>` header using `firebase-admin` SDK. The UID extracted from the verified token is used for audit purposes only — shipments are not scoped per user in the new model (all authenticated users see all shipments).

---

## Real-Time Synchronisation Flow

```
Client submits form
      ↓
POST /api/shipments
      ↓
MongoDB write confirmed
      ↓
emitShipmentCreated(shipment)   ← Socket.io server emits
      ↓
All connected clients receive "shipment_created"
      ↓
StoreContext dispatches ADD_SHIPMENT
      ↓
UI re-renders with new shipment — no additional API call
```

Status update follows the same pattern via `PATCH` + `shipment_updated` event.

---

## Environment Variables

| Variable                          | Used by          | Required |
|-----------------------------------|------------------|----------|
| `MONGODB_URI`                     | `mongodb.ts`     | Yes      |
| `MONGODB_DB_NAME`                 | `mongodb.ts`     | No (default: `sentinelroute`) |
| `OSRM_BASE_URL`                   | `osrm.ts`        | Yes      |
| `OPENWEATHER_API_KEY`             | `weather.ts`     | Yes      |
| `GEMINI_API_KEY`                  | `gemini.ts`      | Yes      |
| `NEXT_PUBLIC_FIREBASE_API_KEY`    | `firebase.ts`    | Yes      |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`| `firebase.ts`    | Yes      |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `firebase.ts`    | Yes      |
| `FIREBASE_SERVICE_ACCOUNT_JSON`   | API auth verify  | Yes      |

---

## Correctness Properties

The following properties must hold at all times and are verified by the property-based test suite.

### P1 — Shipment ID Format
Every `shipmentId` stored in MongoDB matches the regex `/^SR-\d{4}$/`.

### P2 — Shipment ID Uniqueness
No two documents in the `shipments` collection share the same `shipmentId`.

### P3 — Risk Score Determinism
For any fixed `(distanceKm, durationHours, weatherFactor, deadline, cargoType)` tuple, `computeRisk` always returns the same `riskScore` and `riskLevel`.

### P4 — Risk Level Boundaries
- `riskScore ∈ (0, 10]` → `riskLevel === "Low"`
- `riskScore ∈ (10, 20]` → `riskLevel === "Medium"`
- `riskScore > 20` → `riskLevel === "High"`

### P5 — Weather Factor Bounds
`weatherFactor` is always in the range `[0, 5]` (minimum: all Clear; maximum: all Thunderstorm).

### P6 — Weather Sampling Count
`sampleRouteWeather` always samples exactly 5 points regardless of geometry length (or all points if fewer than 5 exist).

### P7 — Gemini Call Count
For any single `POST /api/shipments` request, the Gemini API is called at most twice (one initial attempt + one retry).

### P8 — MongoDB Write Before Response
The HTTP response for `POST /api/shipments` is never returned before the MongoDB write operation completes.

### P9 — Socket Emit After Write
`emitShipmentCreated` and `emitShipmentUpdated` are never called before the corresponding MongoDB write is confirmed.

### P10 — No Firestore or Google Maps Imports
The compiled module graph contains no import of `firebase/firestore`, `@vis.gl/react-google-maps`, or `@googlemaps/js-api-loader`.

### P11 — Zod Validation Before Processing
Any request body that fails Zod validation results in HTTP 400 and zero calls to OSRM, OpenWeather, Gemini, or MongoDB.

### P12 — API Response Envelope
Every API response body has exactly one of `{ success: true, data: ... }` or `{ success: false, error: string }`.
