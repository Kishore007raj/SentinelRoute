<div align="center">

# SentinelRoute

**AI-Powered Logistics Intelligence for Resilient Supply Chains**

*From shipment creation to dynamic rerouting and explainable dispatch decisions — all in one platform.*

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Shadcn UI](https://img.shields.io/badge/Shadcn_UI-Components-black?style=flat-square)](https://ui.shadcn.com)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-Animations-black?style=flat-square&logo=framer)](https://www.framer.com/motion/)
[![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com)
[![Recharts](https://img.shields.io/badge/Recharts-Analytics-FF6384?style=flat-square)](https://recharts.org)

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Firebase Auth](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-black?style=flat-square&logo=socket.io)](https://socket.io)

[![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-Tiles-7EBC6F?style=flat-square&logo=openstreetmap&logoColor=white)](https://www.openstreetmap.org)
[![OSRM](https://img.shields.io/badge/OSRM-Routing-0A84FF?style=flat-square)](https://project-osrm.org)
[![OpenWeather](https://img.shields.io/badge/OpenWeather-API-FFB300?style=flat-square)](https://openweathermap.org/api)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini)

[![Zod](https://img.shields.io/badge/Zod-Validation-3E67B1?style=flat-square)](https://zod.dev)
[![JWT](https://img.shields.io/badge/JWT-Secure_Auth-000000?style=flat-square&logo=jsonwebtokens)](https://jwt.io)

[![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?style=flat-square&logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Prototype_Ready-brightgreen?style=flat-square)]()

---

*Built for smart supply chains, route reliability, and disruption resilience.*

</div>

---

## The Problem

Modern logistics tools optimize for speed. They ignore reliability.

The fastest route fails more often than it should - and when it does, there's no intelligence to explain why or what to do next.

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

SentinelRoute generates multiple route options for every shipment and scores each one using a composite risk engine - before dispatch, not after failure.

Every route is evaluated across:

- Live traffic patterns and congestion signals
- Weather conditions along the full corridor
- Route stability and historical disruption data
- Cargo type sensitivity and urgency level
- Distance, ETA accuracy, and fuel exposure

The platform then recommends the optimal route with a clear AI-generated explanation - so dispatchers understand *why*, not just *what*.

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
- 🚚 Multi-route generation - fastest, balanced, and safest options per shipment
- ⚠️ Dynamic risk scoring - composite 0–100 score per route, updated per analysis
- 🌦 Weather disruption intelligence - live OpenWeather corridor sampling
- 🗺 Live route intelligence map - interactive Leaflet map with route overlays

**AI & Decision Layer**
- 🧠 Gemini-powered route reasoning - explainable AI rationale for every dispatch decision
- 🔁 Smart rerouting engine - risk-aware route comparison with delta indicators
- 📦 Shipment Pass - structured dispatch authorization with integrity hash

**Operations & Analytics**
- 📊 Analytics dashboard - risk trends, route performance, cargo breakdown
- 🔔 Real-time alerts - predictive warnings surfaced before dispatch
- 📈 Historical shipment insights - full audit trail per shipment

---

## Product Walkthrough

<img src="assets/SentinelRoute user flow chart.png" width="900" alt="SentinelRoute Architecture Diagram" />


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

## System Architecture

<img src="assets/SentinelRoute architecture.png" width="900" alt="SentinelRoute Architecture Diagram" />

---

## Tech Stack

SentinelRoute is built with a lean prototype stack optimized for rapid execution, real-world testing, and low operational cost.  
Its architecture is intentionally modular, allowing a direct upgrade path into the Google ecosystem for enterprise-scale logistics intelligence.

---

### Current Prototype Stack

| Layer | Technologies | Role |
|---|---|---|
| **Frontend** | Next.js, TypeScript, Tailwind CSS, Shadcn UI, Framer Motion | High-performance responsive web platform |
| **Maps & Routing** | Leaflet, React-Leaflet, OpenStreetMap, OSRM, Nominatim | Route visualization, geocoding, dynamic path generation |
| **Backend** | Next.js API Routes, Node.js | Shipment workflows, route orchestration, analytics APIs |
| **Database** | MongoDB Atlas | Shipment records, route history, operational insights |
| **Authentication** | Firebase Authentication, Firebase Admin SDK | Secure user login, Google Sign-In, session control |
| **AI Layer** | Google Gemini API | Route reasoning, explainable recommendations, decision support |
| **Real-Time** | Socket.io | Live shipment updates, route alerts, instant notifications |
| **Analytics** | Recharts | Operational dashboards, trend intelligence |
| **Security** | Zod, JWT, AES-256-GCM, SHA-256 | Validation, token security, encrypted fields, audit integrity |
| **Deployment** | Vercel | Fast global deployment for prototype and MVP stage |

---

### Google Ecosystem Scale-Up Roadmap

SentinelRoute is designed to transition into a Google-native logistics SaaS platform capable of serving enterprise fleets, high shipment volumes, and multi-region operations.

| Layer | Google Ecosystem Upgrade | Strategic Value |
|---|---|---|
| **Cloud Platform** | Google Cloud Platform | Unified enterprise infrastructure |
| **Compute** | Cloud Run | Auto-scaling containerized backend services |
| **API Management** | API Gateway | Secure, monitored external integrations |
| **Database** | Firestore + BigQuery | Real-time operational data + large-scale analytics |
| **Maps Intelligence** | Google Maps Platform | Premium routing, traffic intelligence, ETA precision |
| **AI & Prediction** | Gemini + Vertex AI | Delay prediction, optimization models, decision automation |
| **Storage** | Google Cloud Storage | Documents, shipment proofs, reports, media |
| **Streaming Data** | Pub/Sub | Real-time fleet events and logistics signals |
| **Monitoring** | Cloud Logging, Cloud Monitoring | Production observability and alerting |
| **Identity & Security** | Firebase Auth + IAM + Secret Manager | Enterprise-grade access control and secret management |
| **Global Scale** | Multi-region deployment + CDN | Low-latency global logistics operations |
| **CI/CD** | Cloud Build + GitHub Actions | Automated testing and production releases |

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

Each route also receives a SHA-256 integrity hash at analysis time - tamper-evident by design.

---

## Why It Matters

- **Reduces route uncertainty** - risk is quantified before every dispatch, not discovered after
- **Improves ETA accuracy** - risk-adjusted estimates outperform speed-only predictions
- **Lowers operational cost** - fewer failed routes, fewer reactive decisions
- **Prevents repeated mistakes** - historical shipment data informs future routing
- **Builds dispatcher trust** - AI reasoning is transparent, not a black box
- **Scales with operations** - architecture supports fleet-level volume without redesign

---

## Roadmap

| Phase | Feature |
|---|---|
| v1.1 | Fleet optimization engine - multi-vehicle dispatch coordination |
| v1.2 | Driver mobile app - React Native with live GPS push |
| v1.3 | IoT live GPS tracking - real-time vehicle position on map |
| v2.0 | Carbon-efficient routing - emissions scoring per route |
| v2.1 | Enterprise reporting suite - exportable PDF/CSV analytics |
| v2.2 | Role-based access control - dispatcher, manager, admin tiers |
| v3.0 | BigQuery analytics integration - warehouse-scale shipment intelligence |
| v3.1 | Google Cloud deployment - auto-scaling, global edge delivery |

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

## License

The SentinelRoute platform is released under the  [MIT License](LICENSE).

> Advanced enterprise modules, large-scale fleet orchestration, and premium analytics capabilities may be introduced in future commercial releases.

---

<div align="center">

**Built for resilient logistics and smarter operations**

**SentinelRoute** - Because routing decisions should be reliable, explainable, and data-driven.

</div>
