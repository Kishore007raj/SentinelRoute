# Environment Variables

**Related:** [Deployment](deployment.md) · [Security](security.md) · [Back to README](../README.md)

---

## Setup

```bash
cp .env.example .env.local
```

Fill in all required values before running `npm run dev` or deploying.

---

## Full Variable Reference

### MongoDB

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string. Format: `mongodb+srv://<user>:<password>@cluster.mongodb.net/?appName=SentinelRoute` |
| `MONGODB_DB_NAME` | No | Database name. Defaults to `sentinelroute` if unset. |

### Firebase Client SDK (Public -safe to expose)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth domain (e.g., `your-project.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase Cloud Messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase App ID |

### Firebase Admin SDK (Server-only -never expose publicly)

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Yes | Same as the public project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes | Service account email from Firebase Console |
| `FIREBASE_PRIVATE_KEY` | Yes | Service account private key (include newlines as `\n`) |

### External APIs

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI explanations |
| `OPENWEATHER_API_KEY` | Yes | OpenWeather API key for weather corridor sampling |
| `OSRM_BASE_URL` | No | OSRM server base URL. Defaults to the public demo server if unset. |
| `GEOAPIFY_API_KEY` | No | Geoapify API key for address autosuggest |

### Encryption

| Variable | Required | Description |
|---|---|---|
| `DATA_ENCRYPTION_KEY` | Yes | 32-byte base64 key used for AES-256-GCM field encryption (Aadhaar numbers). Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

### WebSocket

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_ENABLE_WEBSOCKET` | No | Set to `"true"` to enable Socket.io. Leave unset or empty on Vercel to activate the polling fallback. |

---

## Example `.env.local`

```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?appName=SentinelRoute

# Firebase Client SDK (public)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK (server-only)
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# External APIs
GEMINI_API_KEY=AIza...
OPENWEATHER_API_KEY=abc123...

# Encryption
DATA_ENCRYPTION_KEY=<32-byte-base64-value>

# WebSocket (local dev only -leave unset on Vercel)
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
```
