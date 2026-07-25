# Project Structure

Annotated repository tree explaining every major folder and file.

**Related:** [Architecture](architecture.md) · [Modules](modules.md) · [API Reference](api-reference.md) · [Back to README](../README.md)

---

## Full Tree

```
sentinelroute/
├── src/
│   ├── app/
│   │   ├── (app)/                        # Protected app shell -auth + company guards
│   │   │   ├── layout.tsx                # Auth guard, company status routing, app shell
│   │   │   ├── dashboard/                # Main dashboard -KPIs, shipment feed
│   │   │   ├── shipments/                # Shipment list + detail pages
│   │   │   │   └── [shipmentId]/         # Individual shipment detail + timeline
│   │   │   ├── create-shipment/          # Shipment creation form with Geoapify
│   │   │   ├── routes/                   # Route comparison Decision Workspace
│   │   │   ├── route-intelligence/       # Corridor intelligence and route scoring
│   │   │   ├── analytics/                # Operational analytics dashboard
│   │   │   ├── workforce/                # Workforce management hub
│   │   │   │   ├── drivers/              # Driver list + profile pages
│   │   │   │   ├── vehicles/             # Vehicle list + profile pages
│   │   │   │   └── users/                # Company user management
│   │   │   ├── fleet-ops/                # Fleet Operations overview
│   │   │   ├── driver-ops/               # Driver Operations overview
│   │   │   ├── command-center/           # Incident command + operational alerts
│   │   │   ├── company/
│   │   │   │   └── intelligence/         # Risk Center, Incidents, Heatmap, Corridors
│   │   │   ├── executive/                # Executive analytics sub-views
│   │   │   └── settings/                 # User + company settings
│   │   ├── api/
│   │   │   ├── shipments/                # GET, POST, PATCH shipments + assignment
│   │   │   ├── analyze-routes/           # Route analysis pipeline
│   │   │   ├── execution/                # Trip execution workflow + location + checkpoints
│   │   │   ├── intelligence/             # Incidents, alerts, recommendations, corridors, heatmap
│   │   │   ├── operational/              # Feed + health score APIs
│   │   │   ├── workforce/                # Drivers, vehicles, users, dashboard, audits
│   │   │   ├── analytics/                # 11 analytics endpoints + report engine
│   │   │   ├── company/                  # Registration, documents, settings, language
│   │   │   ├── admin/                    # Company management, audit, platform health
│   │   │   ├── settings/                 # User settings
│   │   │   ├── ai-insight/               # On-demand AI insight endpoint
│   │   │   ├── geoapify/                 # Address autosuggest proxy
│   │   │   ├── user/                     # User language preference
│   │   │   └── health/                   # Platform health check
│   │   ├── auth/                         # Sign-in + sign-up pages
│   │   ├── company/                      # Company onboarding flow pages
│   │   ├── admin/                        # Super Admin portal pages
│   │   └── layout.tsx                    # Root layout -providers
│   ├── lib/
│   │   ├── types.ts                      # Single source of truth for all types
│   │   ├── mongodb.ts                    # MongoDB client singleton + index setup
│   │   ├── schemas.ts                    # Zod validation schemas
│   │   ├── osrm.ts                       # OSRM routing client
│   │   ├── weather.ts                    # WeatherSampler -5-point parallel fetch
│   │   ├── risk.ts                       # Deterministic RiskEngine
│   │   ├── gemini.ts                     # Gemini AI client with retry logic
│   │   ├── socket-server.ts              # Socket.io server singleton
│   │   ├── socket-client.ts              # Socket.io client hook
│   │   ├── store.tsx                     # useReducer-based client state
│   │   ├── auth-context.tsx              # Firebase Auth context
│   │   ├── company-context.tsx           # Company + UserRecord context
│   │   ├── auth-helpers.ts               # Role matrix + API auth helpers
│   │   ├── firebase.ts                   # Firebase Auth only (no Firestore)
│   │   ├── firebase-admin.ts             # Firebase Admin SDK singleton
│   │   ├── audit.ts                      # Company audit helper
│   │   ├── workforce-audit.ts            # Workforce audit helper (insert-only)
│   │   ├── logger.ts                     # Structured server-side logger
│   │   ├── time.ts                       # UTC time utilities
│   │   ├── utils.ts                      # Risk label, cn, and general utilities
│   │   └── analytics/
│   │       └── report-engine.ts          # PDF/XLSX report generation
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx            # Desktop sidebar + mobile nav
│   │   │   ├── AppHeader.tsx             # Top bar with user menu
│   │   │   └── PageTransition.tsx        # Framer Motion page transitions
│   │   ├── shipment/                     # Shipment-specific components
│   │   │   ├── ShipmentRiskPanel.tsx     # Risk score panel with breakdown
│   │   │   ├── ShipmentPass.tsx          # Dispatch authorization card
│   │   │   └── RouteCard.tsx             # Route option comparison card
│   │   ├── workforce/                    # Workforce management components
│   │   │   ├── DriverForm.tsx            # Add/edit driver dialog
│   │   │   ├── DriverTable.tsx           # Driver list with actions
│   │   │   ├── VehicleForm.tsx           # Add/edit vehicle dialog
│   │   │   ├── VehicleTable.tsx          # Vehicle list with actions
│   │   │   ├── AssignDriverModal.tsx     # Driver selection for vehicle assignment
│   │   │   ├── UserForm.tsx              # Invite user dialog
│   │   │   ├── UserTable.tsx             # Company users with role management
│   │   │   └── ExpiryBadge.tsx           # 30-day expiry warning badge/indicator
│   │   └── ui/                           # Shadcn UI primitive components
│   └── hooks/                            # Custom React hooks
│       ├── use-socket.ts                 # Socket.io connection and event management
│       └── use-i18n-company.ts           # Company/user language sync hook
├── docs/                                 # Engineering documentation
├── scripts/
│   └── seed-festivals.ts                 # Festival calendar seeder for risk scoring
├── server.ts                             # Custom Node.js HTTP + Socket.io server
├── next.config.ts                        # Next.js configuration
├── tailwind.config.ts                    # Tailwind CSS configuration
├── tsconfig.json                         # TypeScript configuration (strict: true)
├── eslint.config.mjs                     # ESLint configuration
├── .env.example                          # Environment variable template
└── firestore.indexes.json                # Firestore index definitions (legacy reference)
```

---

## Key Files Explained

### `src/lib/types.ts`

The single source of truth for all TypeScript interfaces in the platform. Every module imports from here. No module defines its own local types that duplicate centralized ones. Contains all domain types: `Shipment`, `Route`, `Driver`, `Vehicle`, `Incident`, `OperationalRecommendation`, `ShipmentTimelineEvent`, `OperationalHealthScore`, `WorkforceAudit`, `UserRole`, and more.

### `src/lib/store.tsx`

The `useReducer`-based client state container. Manages `shipments`, `pendingShipment`, `operationalFeed`, `operationalHealth`, `presence`, and `kpis`. Includes `fetchWithResilience` (9s timeout + retry) and `fetchWithAuth` (token refresh + sign-out on persistent 401). All socket event handlers are registered here.

### `src/lib/auth-helpers.ts`

Role matrix constants and API auth helpers: `requireWorkforceRead`, `requireWorkforceWrite`, `requireUserMgmt`, `requireCompanyAdmin`. These functions verify the Firebase ID token, resolve the `UserRecord`, check role permissions, and return the authenticated context to the route handler.

### `src/lib/risk.ts`

The deterministic, stateless Risk Engine. Input: `(distanceKm, durationHours, weatherFactor, deadline, cargoType)`. Output: `{ riskScore, riskLevel }`. No randomness, no external calls.

### `src/lib/gemini.ts`

The Gemini AI client. Calls `generateExplanation()` once per shipment with one retry on HTTP 429. Returns a fallback string on double failure. Maximum two API calls per shipment invocation.

### `src/lib/workforce-audit.ts`

Insert-only audit helper. `createWorkforceAuditEvent()` inserts to `workforce_audits` and never re-throws on failure -audit errors are logged but never break the primary operation.

### `server.ts`

The custom Node.js HTTP server that binds the Socket.io `Server` instance to the same HTTP server as Next.js. Used in development (`npm run dev`) and production with WebSocket (`npm run start:ws`).
