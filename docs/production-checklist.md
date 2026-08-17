# SentinelRoute — Production Checklist

> Module 11 Engineering Hardening  
> Last updated: 2026

---

## Pre-Deployment Checklist

Run this checklist before every production deployment.

### 1. Build Verification

```bash
# TypeScript — must produce zero errors
node node_modules/typescript/bin/tsc --noEmit

# ESLint — must produce zero errors
npm run lint

# Tests — must all pass
npm test

# Production build — must succeed
npm run build
```

All four commands must exit with code `0`.

### 2. Environment Variables

Verify all required variables are set in the deployment environment.  
**Never commit `.env.local` or any file containing real secrets.**

#### Required for production (server-side only — never `NEXT_PUBLIC_`)

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB Atlas connection string | ✅ Critical |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK project ID | ✅ Critical |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK service account email | ✅ Critical |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK private key (newlines as `\n`) | ✅ Critical |
| `GEOAPIFY_API_KEY` | Geoapify geocoding + routing API key | ✅ Critical |
| `OPENWEATHER_API_KEY` | OpenWeather API key | ✅ Critical |
| `NEWS_API_KEY` | NewsAPI key | ✅ Critical |
| `TRAFFIC_API_KEY` | TomTom traffic API key | ✅ Critical |
| `DATA_ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM | ✅ Critical |
| `AADHAAR_ENCRYPTION_KEY` | 32-byte base64 key for Aadhaar encryption | ✅ Critical |
| `SUPER_ADMIN_SEED_SECRET` | One-time seed secret for super admin setup | ⚠️ Rotate after first use |
| `GEMINI_API_KEY` | Google Gemini API key for AI insights | Optional |

#### Required at build time (safe for `NEXT_PUBLIC_` — baked into client bundle)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client SDK key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |

#### Optional runtime variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_ENABLE_WEBSOCKET` | Set to `"true"` to enable Socket.IO (custom server only) |
| `NEXT_PUBLIC_APP_URL` | Canonical URL for CORS and links (default: `http://localhost:3000`) |
| `PORT` | HTTP server port (default: `3000`) |

### 3. MongoDB Atlas Configuration

- [ ] Cluster tier: **M10 or higher** for production (M0 free tier is not suitable)
- [ ] Network access: IP allowlist includes all deployment server IPs
- [ ] Database user has `readWrite` permission on the `sentinelroute` database
- [ ] Atlas backup enabled (see Backup Strategy below)
- [ ] Connection string uses `?retryWrites=true&w=majority`

### 4. Firebase Configuration

- [ ] Firebase project is in **production** mode (not test mode)
- [ ] Authentication → Sign-in providers: Email/Password enabled
- [ ] Authentication → Authorized domains includes the production domain
- [ ] Service account key is from Firebase Console → Project Settings → Service Accounts
- [ ] Private key file is **not** committed to version control

### 5. Security Headers Verification

After deployment, verify headers with:

```bash
curl -I https://your-domain.com/
```

Expected headers present:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: ...`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 6. Health Check Verification

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "db": "ok",
  "dbLatencyMs": <number>,
  "timestamp": "<ISO string>",
  "uptimeSec": <number>,
  "version": "1.0.0"
}
```

HTTP 200 = healthy. HTTP 503 = database unreachable.

### 7. Super Admin Setup (First Deployment Only)

```bash
# Run once to seed super admin accounts
curl -X POST https://your-domain.com/api/admin/seed-super-admin \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{"secret": "<SUPER_ADMIN_SEED_SECRET>"}'
```

- Rotate `SUPER_ADMIN_SEED_SECRET` after first use
- Verify super admin accounts can log in and access `/admin`

---

## MongoDB Backup Strategy

### Current Status

MongoDB Atlas provides **automated backups** on M10+ clusters:
- **Continuous backups**: point-in-time restore capability
- **Scheduled snapshots**: daily snapshots, retained per Atlas tier policy
- Atlas backup is **managed infrastructure** — no application-level backup code is required

### What is NOT configured

- Application-level `mongodump` scheduled jobs are **not configured**
- Custom backup scripts are **not implemented**

### Recommendation

1. Enable Atlas **Continuous Cloud Backup** in Atlas → Cluster → Backup
2. Configure snapshot retention to match data retention requirements (e.g., 30 days)
3. Test restore procedure in a staging environment before going live
4. For compliance requirements, configure Atlas **Backup Compliance Policy**

### Manual Backup (emergency / development)

```bash
# Requires mongodump installed locally
mongodump \
  --uri="$MONGODB_URI" \
  --db=sentinelroute \
  --out=./backup/$(date +%Y%m%d)
```

---

## Recovery Procedures

### Application Recovery

1. **Rollback a deployment:**
   - Redeploy the previous Docker image / git tag
   - If using Vercel: Deployments → Instant Rollback
   - Verify health check returns 200 after rollback

2. **Environment variable recovery:**
   - All production secrets must be stored in a secrets manager (AWS Secrets Manager / Vault / Vercel environment variables)
   - Never rely on local `.env.local` for production secrets

3. **Firebase Admin key rotation:**
   - Generate new service account key in Firebase Console
   - Update `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` in deployment environment
   - Redeploy — no downtime required (lazy initialization handles the switch)

### Database Recovery

1. **Point-in-time restore (Atlas):**
   - Atlas → Cluster → Backup → Restore
   - Select point in time before incident
   - Restore to a new cluster first, verify data, then promote

2. **Index recreation:**
   - All indexes are created idempotently by `ensureIndexes()` on first DB connection
   - No manual index recreation required after restore

3. **Data corruption incident:**
   - Stop writes immediately (set maintenance mode or disable the application)
   - Assess damage scope in Atlas Data Explorer
   - Restore from most recent clean snapshot
   - Replay any missing writes from audit logs if available

---

## Post-Deployment Verification

Run these checks within 15 minutes of every production deployment:

- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Sign in with a test account — confirm Firebase auth works
- [ ] Load the dashboard — confirm shipments load
- [ ] Check server logs for any `[error]` entries
- [ ] Verify no `STARTUP FAILURE` or `Missing required environment variable` in logs
- [ ] Run one smoke test API call: `GET /api/shipments` with valid auth token
- [ ] For super admin: verify `/admin` loads and shows real tenant data

---

## Incident Response

### Severity 1 — Application down / data loss risk

1. Immediately notify on-call engineer
2. Check `GET /api/health` — if 503, MongoDB is unreachable
3. Check Atlas cluster status at `cloud.mongodb.com`
4. If DB unreachable: check network access rules, connection string, Atlas status page
5. If data loss suspected: stop writes, restore from backup, assess scope
6. Post-incident: write incident report, update runbook

### Severity 2 — Degraded performance / errors in logs

1. Check server logs for recurring error patterns
2. Check MongoDB Atlas performance advisor for slow queries
3. Check rate limiting — are legitimate users being blocked?
4. Check Firebase Auth status at `status.firebase.google.com`

### Severity 3 — Minor UI issues / non-critical API errors

1. Create a GitHub issue with reproduction steps
2. Schedule fix in next sprint
3. Add regression test

---

## Data Retention

| Collection | Data Type | Recommended Retention |
|-----------|----------|-----------------------|
| `company_audits` | Audit trail | 7 years (compliance) |
| `shipments` | Business data | 5 years |
| `intelligence_audits` | Intelligence events | 1 year |
| `workforce_audits` | Workforce events | 3 years |
| `analytics_reports` | Report metadata | 1 year |
| `route_predictions` | ML predictions | 90 days |
| `weather_snapshots` | Weather data | 30 days |
| `operational_alerts` | Alerts | 90 days |

These are **recommendations**. Actual retention must comply with applicable regulations (GDPR, Indian data protection law, etc.).

Data deletion is **not automated** in the current implementation. MongoDB Atlas TTL indexes can be added per collection to automate expiry.

---

## Deployment Architecture Notes

### Custom Server Mode (`npm run start:ws`)

Used when Socket.IO real-time features are required:
- Starts `server.ts` with `tsx` as the process manager
- Socket.IO listens on `/api/socket` (path configured in `next.config.ts`)
- Use a process manager (PM2, systemd) to keep the process alive
- `NEXT_PUBLIC_ENABLE_WEBSOCKET=true` must be set

### Serverless Mode (Vercel / Edge)

- Socket.IO is disabled (no custom server)
- The store falls back to HTTP polling every 30 seconds
- `NEXT_PUBLIC_ENABLE_WEBSOCKET` must be empty or absent
- All API routes run as serverless functions
- **Limitation:** In-process rate limiter state is NOT shared across function instances. For production multi-instance deployments, replace `src/lib/rate-limit.ts` with a Redis-backed implementation.

---

## Known Limitations

1. **Rate limiting scope:** The in-process rate limiter in `src/lib/rate-limit.ts` only protects a single process instance. In a horizontally scaled deployment (multiple Node.js processes or serverless), each instance has its own state. A Redis-backed limiter is required for global protection.

2. **Socket.IO requires sticky sessions** in a multi-instance deployment. Configure load balancer to route requests from the same client to the same instance (sticky sessions / IP hash).

3. **Firebase Admin lazy initialization:** The Firebase Admin SDK is initialized on the first authenticated request per process. Cold starts will include SDK initialization latency (~100-300ms).
