<div align="center">

# SentinelRoute

**AI-Powered Logistics Intelligence for Resilient Supply Chains**

*From shipment creation to dynamic rerouting and explainable dispatch decisions — all in one platform.*

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Prototype%20Ready-brightgreen?style=flat-square)]()

---

*Built for smart supply chains, route reliability, and disruption resilience.*

</div>

---

## The Problem

Modern logistics tools optimize for speed. They ignore reliability.

The fastest route fails more often than it should — and when it does, there's no intelligence to explain why or what to do next.

| Root Cause | Real-World Impact |
|---|---|
| Weather disruptions | Missed delivery windows, cargo damage |
| Traffic bottlenecks | Cascading ETA failures |
| Operational delays | Unplanned cost overruns |
| No risk visibility | Reactive decisions instead of proactive ones |
| Single-route dependency | No fallback when conditions change |

Logistics teams are left guessing. SentinelRoute changes that.

---

## The Solution

SentinelRoute generates multiple route options for every shipment and scores each one using a composite risk engine — before dispatch, not after failure.

Every route is evaluated across:

- Live traffic patterns and congestion signals
- Weather conditions along the full corridor
- Route stability and historical disruption data
- Cargo type sensitivity and urgency level
- Distance, ETA accuracy, and fuel exposure

The platform then recommends the optimal route with a clear AI-generated explanation — so dispatchers understand *why*, not just *what*.

---

## Why SentinelRoute is Different

| Capability | Traditional Tools | SentinelRoute |
|---|---|---|
| Route options | Single fastest path | Fastest · Balanced · Safest |
| Risk intelligence | None | Composite score per route |
| ETA reliability | Speed-based estimate | Risk-adjusted prediction |
| Disruption handling | Manual rerouting | Predictive alerts pre-dispatch |
| Decision transparency | None | Gemini-powered AI reasoning |
| Shipment memory | None | Full history + analytics |
| Cargo awareness | None | Sensitivity-adjusted scoring |
| Multi-factor scoring | None | Traffic + Weather + Disruption + Cargo |

---

## Core Features

**Route Intelligence**
- 🚚 Multi-route generation — fastest, balanced, and safest options per shipment
- ⚠️ Dynamic risk scoring — composite 0–100 score per route, updated per analysis
- 🌦 Weather disruption intelligence — live OpenWeather corridor sampling
- 🗺 Live route intelligence map — interactive Leaflet map with route overlays

**AI & Decision Layer**
- 🧠 Gemini-powered route reasoning — explainable AI rationale for every dispatch decision
- 🔁 Smart rerouting engine — risk-aware route comparison with delta indicators
- 📦 Shipment Pass — structured dispatch authorization with integrity hash

**Operations & Analytics**
- 📊 Analytics dashboard — risk trends, route performance, cargo breakdown
- 🔔 Real-time alerts — predictive warnings surfaced before dispatch
- 📈 Historical shipment insights — full audit trail per shipment

---

## Product Walkthrough

```
1. Authenticate          →  Firebase Auth (email / OAuth)
2. Create Shipment       →  Origin, destination, cargo type, vehicle, urgency, deadline
3. Generate Routes       →  OSRM routing + OpenWeather corridor analysis
4. Compare Options       →  Fastest / Balanced / Safest with risk scores
5. Review AI Reasoning   →  Gemini explains the recommendation
6. Confirm Dispatch      →  Shipment Pass generated with integrity hash
7. Monitor Live          →  Real-time status via Socket.io
8. Complete & Archive    →  Analytics updated, full audit trail stored
```

---

## Screenshots

### Landing Page
![Landing Page](public/screenshots/landing.png)

### Authentication
![Authentication](public/screenshots/auth.png)

### Shipment Creation
![Shipment Creation](public/screenshots/create-shipment.png)

### Route Selection
![Route Selection](public/screenshots/routes.png)

### Dashboard Analytics
![Dashboard](public/screenshots/dashboard.png)

### Shipment Summary
![Shipment Summary](public/screenshots/shipment-detail.png)

> Screenshots will be added after final UI polish. Replace paths above with actual captures.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│         Next.js 16 · React 19 · Tailwind · Framer       │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────▼──────────────────────────────┐
│                   Next.js API Layer                      │
│     /api/analyze-routes  /api/shipments  /api/ai-insight │
│              Firebase Admin · Zod · JWT                  │
└────┬──────────────┬──────────────┬───────────────────────┘
     │              │              │
┌────▼────┐  ┌──────▼──────┐  ┌───▼──────────────────────┐
│ MongoDB │  │ Firebase    │  │   External Services       │
│  Atlas  │  │    Auth     │  │  OSRM · OpenWeather       │
│         │  │             │  │  Gemini AI · Nominatim    │
└─────────┘  └─────────────┘  └───────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │      Socket.io          │
              │  Real-time shipment     │
              │  status + alerts        │
              └─────────────────────────┘
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS 4, Shadcn UI, Framer Motion |
| **Maps & Routing** | Leaflet, React-Leaflet, OSRM, OpenStreetMap, Nominatim |
| **Charts** | Recharts |
| **Backend** | Next.js API Routes, Node.js |
| **Database** | MongoDB Atlas |
| **Authentication** | Firebase Auth, Firebase Admin SDK |
| **AI** | Google Gemini 2.0 Flash |
| **Real-time** | Socket.io 4.8 |
| **Security** | Zod validation, JWT, AES-256-GCM field encryption, SHA-256 decision hashing |
| **Deployment** | Vercel |

---

## Risk Scoring Engine

Every route receives a composite risk score computed as:

```
riskScore = (
  traffic    × 0.30 +
  weather    × 0.30 +
  disruption × 0.25 +
  cargo      × 0.15
) × urgencyMultiplier
```

**Inputs**

| Factor | Source | Weight |
|---|---|---|
| Traffic congestion | OSRM duration vs static ETA | 30% |
| Weather severity | OpenWeather corridor sampling | 30% |
| Route disruption | Distance + delay ratio + warnings | 25% |
| Cargo sensitivity | Type-based lookup (Pharma, Cold Chain, Electronics) | 15% |
| Urgency multiplier | Standard 1.0× · Priority 1.2× · Critical 1.45× | Applied last |

**Output:** `low` · `medium` · `high` · `critical`

Each route also receives a SHA-256 integrity hash at analysis time — tamper-evident by design.

---

## Why It Matters

- **Reduces route uncertainty** — risk is quantified before every dispatch, not discovered after
- **Improves ETA accuracy** — risk-adjusted estimates outperform speed-only predictions
- **Lowers operational cost** — fewer failed routes, fewer reactive decisions
- **Prevents repeated mistakes** — historical shipment data informs future routing
- **Builds dispatcher trust** — AI reasoning is transparent, not a black box
- **Scales with operations** — architecture supports fleet-level volume without redesign

---

## Roadmap

| Phase | Feature |
|---|---|
| v1.1 | Fleet optimization engine — multi-vehicle dispatch coordination |
| v1.2 | Driver mobile app — React Native with live GPS push |
| v1.3 | IoT live GPS tracking — real-time vehicle position on map |
| v2.0 | Carbon-efficient routing — emissions scoring per route |
| v2.1 | Enterprise reporting suite — exportable PDF/CSV analytics |
| v2.2 | Role-based access control — dispatcher, manager, admin tiers |
| v3.0 | BigQuery analytics integration — warehouse-scale shipment intelligence |
| v3.1 | Google Cloud deployment — auto-scaling, global edge delivery |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/sentinelroute.git
cd sentinelroute

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Fill in your credentials (see below)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?appName=SentinelRoute

# Firebase Client SDK (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-only)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# External APIs
GEMINI_API_KEY=
OPENWEATHER_API_KEY=

# Encryption
DATA_ENCRYPTION_KEY=   # 32-byte base64 key: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# WebSocket (local dev only — leave unset on Vercel)
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
```

---

## Live Demo

| | Link |
|---|---|
| **Live App** | _Coming soon_ |
| **GitHub Repo** | [github.com/your-username/sentinelroute](https://github.com/your-username/sentinelroute) |
| **Demo Video** | _Coming soon_ |

---

## For Judges & Reviewers

SentinelRoute is not a CRUD app with an AI label attached.

The AI layer is purposeful — Gemini generates route-specific reasoning grounded in real risk data, not generic text. The risk engine is deterministic and auditable. Every dispatch decision is hashed for integrity. The architecture is production-grade: encrypted fields, token-verified API routes, resilient fetch with retry logic, and a real-time layer that degrades gracefully on serverless.

**What makes it stand out:**

- Solves a real, measurable logistics problem
- AI is used to explain decisions, not decorate them
- Full-stack implementation: auth, database, external APIs, real-time, analytics
- Security-first: AES-256 encryption, SHA-256 hashing, Firebase Admin token verification
- Scalable business model with a clear enterprise path

---

## License

MIT © 2026 SentinelRoute

---

<div align="center">
<sub>Built with precision. Designed for scale.</sub>
</div>
