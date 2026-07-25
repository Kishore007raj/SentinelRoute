# Deployment

**Related:** [Environment](environment.md) · [Production Hardening](production-hardening.md) · [Architecture](architecture.md) · [Real-Time](real-time.md) · [Back to README](../README.md)

---

## Development

```bash
npm run dev        # Starts tsx server.ts -custom Node.js HTTP + Socket.io
npm run dev:next   # Starts Next.js only (no WebSocket server)
```

The custom server (`server.ts`) binds the Socket.io `Server` instance to the same HTTP server as Next.js. This is the only way to maintain a persistent WebSocket connection in development.

---

## Production on Vercel

```bash
npm run build      # next build
npm run start      # next start (serverless -no Socket.io server)
```

On Vercel, API routes run as serverless functions. Socket.io is unavailable. Set `NEXT_PUBLIC_ENABLE_WEBSOCKET=` (empty or unset) and the client activates the 30-second polling fallback automatically.

---

## Production with WebSocket

```bash
npm run start:ws   # NODE_ENV=production tsx server.ts
```

Run on a persistent Node.js host to maintain the WebSocket server. Suitable targets:
- Google Cloud Run with `--min-instances=1`
- A VPS (e.g., Compute Engine, DigitalOcean Droplet)
- A dedicated server

---

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs lint and type checks on every push and pull request.

```yaml
# .github/workflows/ci.yml runs:
# - npm run lint
# - npx tsc --noEmit
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Custom Node.js + Socket.io development server |
| `npm run dev:next` | Next.js only (no Socket.io) |
| `npm run build` | Production Next.js build |
| `npm run start` | Production Next.js (serverless) |
| `npm run start:ws` | Production with custom Socket.io server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest (single run) |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Environment Variables

See [environment.md](environment.md) for the full variable reference.

**Required for any deployment:**

```env
MONGODB_URI=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
GEMINI_API_KEY=
OPENWEATHER_API_KEY=
DATA_ENCRYPTION_KEY=
```

**WebSocket toggle (leave unset on Vercel):**
```env
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
```

---

## Google Cloud Scale-Up Path

SentinelRoute is designed to transition into a Google-native logistics SaaS platform.

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
