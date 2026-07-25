<div align="center">

# SentinelRoute

**Logistics Intelligence for Resilient Supply Chains**

*From shipment creation to dynamic rerouting and explainable dispatch decisions -all in one platform.*

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

## Executive Overview

SentinelRoute is an enterprise-grade logistics intelligence platform designed to help organizations plan, monitor, and optimize transportation operations through data-driven decision making. Instead of focusing solely on the fastest route, the platform evaluates operational factors such as weather conditions, traffic disruptions, delivery priorities, and potential risks to recommend the most reliable and efficient route for every shipment.

The platform provides a unified workspace where organizations can manage shipments, fleet operations, workforce activities, and business performance from a single system. Real-time operational visibility enables dispatchers, managers, and executives to monitor shipment progress, respond quickly to changing conditions, and collaborate effectively throughout the delivery lifecycle.

Designed as a secure multi-tenant platform, SentinelRoute allows multiple organizations to operate independently within the same application while ensuring complete isolation of business data. Each organization manages its own users, vehicles, drivers, shipments, operational records, and analytics, providing a scalable solution suitable for businesses of different sizes.

Beyond operational management, SentinelRoute serves as an intelligent decision-support platform. It continuously analyzes operational conditions, assesses potential risks, and generates transparent recommendations with clear explanations to support confident decision making. Developed through eleven implementation modules, the platform integrates shipment management, fleet and workforce operations, operational intelligence, executive analytics, and enterprise administration into a single, scalable solution for modern logistics management.

---

## The Problem

Modern logistics tools optimize for speed. They ignore reliability.

| Root Cause | Real-World Impact |
|---|---|
| Weather disruptions | Missed delivery windows, cargo damage |
| Traffic bottlenecks | Cascading ETA failures |
| Operational delays | Unplanned cost overruns |
| No risk visibility | Reactive decisions instead of proactive ones |
| Single-route dependency | No fallback when conditions change |

---

## The Solution

SentinelRoute generates multiple route options for every shipment and scores each one using a composite risk engine -before dispatch, not after failure.

Every route is evaluated across live traffic patterns, weather conditions along the full corridor, route stability and historical disruption data, cargo type sensitivity, urgency level, distance, and ETA accuracy. The platform then recommends the optimal route with a clear AI-generated explanation -so dispatchers understand *why*, not just *what*.

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
- Multi-route generation -fastest, balanced, and safest options per shipment
- Dynamic risk scoring -composite score per route, updated per analysis
- Weather disruption intelligence -live OpenWeather corridor sampling
- Live route intelligence map -interactive Leaflet map with route overlays

**AI & Decision Layer**
- Gemini-powered route reasoning -explainable AI rationale for every dispatch decision
- Smart rerouting engine -risk-aware route comparison with delta indicators
- Shipment Pass -structured dispatch authorization with SHA-256 integrity hash

**Operations & Analytics**
- Analytics dashboard -risk trends, route performance, cargo breakdown
- Real-time alerts -predictive warnings surfaced before dispatch
- Historical shipment insights -full audit trail per shipment

**Enterprise Platform**
- Multi-tenant isolation with company-scoped workspaces
- Role-based access control across 7 roles
- Immutable audit logs for all company, shipment, and workforce events
- Real-time collaboration with Socket.io presence and company rooms

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

| Layer | Technologies | Role |
|---|---|---|
| **Frontend** | Next.js, TypeScript, Tailwind CSS, Shadcn UI, Framer Motion | High-performance responsive web platform |
| **Maps & Routing** | Leaflet, React-Leaflet, OpenStreetMap, OSRM, Geoapify | Route visualization, geocoding, dynamic path generation |
| **Backend** | Next.js API Routes, Node.js | Shipment workflows, route orchestration, analytics APIs |
| **Database** | MongoDB Atlas | Shipment records, route history, operational insights |
| **Authentication** | Firebase Authentication, Firebase Admin SDK | Secure user login, Google Sign-In, session control |
| **AI Layer** | Google Gemini API | Route reasoning, explainable recommendations, decision support |
| **Real-Time** | Socket.io | Live shipment updates, route alerts, instant notifications |
| **Analytics** | Recharts | Operational dashboards, trend intelligence |
| **Security** | Zod, JWT, AES-256-GCM, SHA-256 | Validation, token security, encrypted fields, audit integrity |
| **Deployment** | Vercel | Fast global deployment for prototype and MVP stage |

---

## Screenshots Gallery

> Screenshots will be added as each module's UI is finalized.

| Screen | Description |
|---|---|
| Dashboard | Live KPI cards, operational feed, health score, and at-risk shipment summary |
| Command Center | Active incidents, operational alerts, and incident command lifecycle |
| Decision Workspace | Multi-route comparison with risk scores, AI explanation, and recommendations |
| Risk Center | Company-wide risk scoring with alert severity breakdown |
| Operational Feed | Time-ordered feed of shipment events, incidents, and recommendations |
| Heatmap | Geographic incident density visualization on interactive Leaflet map |
| Fleet Operations | Vehicle deployment overview with assignment and status indicators |
| Driver Operations | Driver workload summary with operational status and upcoming expiries |
| Executive Analytics | KPI summary, trend charts, and sub-view tabs for deep-dive reporting |
| Settings | User preferences, notification toggles, and company language settings |
| Shipment Timeline | Per-shipment immutable event log with typed event icons |
| Shipment Chat | In-context messaging between dispatcher, driver, and operations manager |

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
# Fill in your credentials -see docs/environment.md

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Key environment variables:**

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/
NEXT_PUBLIC_FIREBASE_API_KEY=
FIREBASE_PROJECT_ID=
GEMINI_API_KEY=
OPENWEATHER_API_KEY=
DATA_ENCRYPTION_KEY=
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
```

See [docs/environment.md](docs/environment.md) for the full variable reference.

---

## Deployment

| Target | Command | Notes |
|---|---|---|
| Development | `npm run dev` | Custom Node.js + Socket.io server |
| Vercel | `npm run build && npm start` | Serverless -polling fallback active |
| Node.js (with WebSocket) | `npm run start:ws` | Persistent process required |

See [docs/deployment.md](docs/deployment.md) for full deployment instructions including environment setup, CI/CD, and Google Cloud upgrade path.

---

## Roadmap

| Phase | Feature |
|---|---|
| v1.1 | Fleet optimization engine -multi-vehicle dispatch coordination |
| v1.2 | Driver mobile app -React Native with live GPS push |
| v1.3 | IoT live GPS tracking -real-time vehicle position on map |
| v2.0 | Carbon-efficient routing -emissions scoring per route |
| v2.1 | Enterprise reporting suite -exportable PDF/CSV analytics |
| v2.2 | Role-based access control -dispatcher, manager, admin tiers |
| v3.0 | BigQuery analytics integration -warehouse-scale shipment intelligence |
| v3.1 | Google Cloud deployment -auto-scaling, global edge delivery |

See [docs/roadmap.md](docs/roadmap.md) for the extended future platform roadmap.

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | System engines, module dependency graph, design principles |
| [Modules](docs/modules.md) | All 11 completed modules -purpose, features, integration, outcome |
| [API Reference](docs/api-reference.md) | Full API endpoint catalog with request/response details |
| [Database](docs/database.md) | Collections, indexes, tenant isolation, immutability, session atomicity |
| [Security](docs/security.md) | Auth, RBAC, tenant isolation, encryption, audit logging, IDOR protection |
| [AI Engine](docs/ai-engine.md) | Risk scoring formula, weather sampling, Gemini integration, explainable AI |
| [Real-Time](docs/real-time.md) | Socket.io rooms, presence, event bus, polling fallback |
| [Deployment](docs/deployment.md) | Development, Vercel, Node.js with WebSocket, Google Cloud upgrade path |
| [Environment](docs/environment.md) | All environment variables with descriptions and requirements |
| [Performance](docs/performance.md) | Latency, indexes, memoization, event-driven architecture, scalability |
| [Production Hardening](docs/production-hardening.md) | Logging, validation, graceful degradation, retry strategy, type safety |
| [Project Structure](docs/project-structure.md) | Annotated repository tree with explanation of every major folder |
| [Development](docs/development.md) | Local setup, scripts, branch naming, commit conventions, PR workflow |
| [Contributing](docs/contributing.md) | Code standards, architecture rules, contribution workflow |
| [Testing](docs/testing.md) | Property-based tests, test framework, correctness properties |
| [FAQ](docs/faq.md) | 17 enterprise questions answered |
| [Roadmap](docs/roadmap.md) | Near-term releases and extended future platform initiatives |
| [Acknowledgements](docs/acknowledgements.md) | Libraries, APIs, frameworks, and services |

---

## Contributing

1. Fork the repository and clone your fork.
2. Copy `.env.example` to `.env.local` and fill in credentials.
3. Run `npm install`, `npm run dev`.
4. Open a PR against `main` following [Conventional Commits](https://www.conventionalcommits.org/).

See [docs/contributing.md](docs/contributing.md) for branch naming, code standards, and the full PR workflow.

---

## License

The SentinelRoute platform is released under the [MIT License](LICENSE).

> Advanced enterprise modules, large-scale fleet orchestration, and premium analytics capabilities may be introduced in future commercial releases.

---

<div align="center">

**Built for resilient logistics and smarter operations**

**SentinelRoute** -Because routing decisions should be reliable, explainable, and data-driven.

[GitHub](https://github.com/your-username/sentinelroute) · [MIT License](LICENSE) · [Report Issue](https://github.com/your-username/sentinelroute/issues)

</div>
