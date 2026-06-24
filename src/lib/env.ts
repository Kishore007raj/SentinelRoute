/**
 * env.ts — Single source of truth for all environment variable access.
 *
 * Rules:
 *   - NEXT_PUBLIC_ variables: validated at build time via requireBuildEnv()
 *   - Server-only secrets: lazy accessors via lazyEnv() — never read at module level
 *   - No other file in src/ may call process.env directly. Use these exports.
 *
 * In production: missing required vars throw at first request (fail-fast).
 * In development: warns and returns "" so the dev server starts without all secrets.
 */

// ─── Build-time helper (NEXT_PUBLIC_ vars only) ───────────────────────────────

function requireBuildEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `[env] Missing required build-time variable: "${key}"\n` +
        `Add it to your deployment environment and redeploy.`
      );
    }
    console.warn(`[env] ⚠️  Missing environment variable: "${key}" — fill in .env.local`);
    return "";
  }
  return value.trim();
}

// ─── Runtime helper (server-only secrets) ────────────────────────────────────

/**
 * Returns a lazy accessor for a server-only environment variable.
 * The variable is NOT read at module evaluation time — only when the
 * returned function is called during a request.
 *
 * In production: throws immediately if the variable is absent or empty.
 * In development: warns and returns "" so the dev server starts without
 *                 all secrets configured.
 *
 * Usage:
 *   const getAadhaarKey = lazyEnv("AADHAAR_ENCRYPTION_KEY");
 *   // later, inside a request handler:
 *   const key = getAadhaarKey();
 */
function lazyEnv(key: string): () => string {
  return (): string => {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          `[env] Missing required environment variable: "${key}"\n` +
          `Add it to your deployment environment and redeploy.`
        );
      }
      console.warn(`[env] ⚠️  Missing environment variable: "${key}" — fill in .env.local`);
      return "";
    }
    return value.trim();
  };
}

// ─── Firebase (client-safe, NEXT_PUBLIC_) ─────────────────────────────────────
// These are inlined at build time — must be present during `next build`.

export const firebaseConfig = {
  apiKey:            requireBuildEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain:        requireBuildEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId:         requireBuildEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket:     requireBuildEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireBuildEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId:             requireBuildEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
} as const;

// ─── Server-only API keys (lazy — validated at request time) ──────────────────

/**
 * MongoDB connection URI — server-side only.
 * Call MONGODB_URI() inside a request handler, never at top level.
 */
export const MONGODB_URI = lazyEnv("MONGODB_URI");

/**
 * OpenWeather API key — server-side only.
 * Call OPENWEATHER_API_KEY() inside a request handler, never at top level.
 */
export const OPENWEATHER_API_KEY = lazyEnv("OPENWEATHER_API_KEY");

/**
 * Google Gemini API key — server-side only.
 * Call GEMINI_API_KEY() inside a request handler, never at top level.
 */
export const GEMINI_API_KEY = lazyEnv("GEMINI_API_KEY");

/**
 * Mappls API key — server-side only.
 * Used for Autosuggest, Geocode, Reverse Geocode, and Route APIs.
 * Call MAPPLS_API_KEY() inside a request handler, never at top level.
 */
export const MAPPLS_API_KEY = lazyEnv("MAPPLS_API_KEY");

/**
 * NewsAPI key — server-side only.
 * Used by news-intelligence.ts to fetch logistics disruption signals.
 * Call NEWS_API_KEY() inside a request handler, never at top level.
 */
export const NEWS_API_KEY = lazyEnv("NEWS_API_KEY");

/**
 * TomTom Traffic API key — server-side only.
 * Used by tomtom.ts for traffic incidents and flow data.
 * Stored in environment as TRAFFIC_API_KEY.
 * Call TRAFFIC_API_KEY() or TOMTOM_API_KEY() (alias) inside a request handler.
 */
export const TRAFFIC_API_KEY = lazyEnv("TRAFFIC_API_KEY");

/**
 * Alias for TRAFFIC_API_KEY — TomTom is the current traffic provider.
 * Use this alias when explicitly referring to TomTom operations.
 */
export const TOMTOM_API_KEY = TRAFFIC_API_KEY;

// ─── Data encryption ──────────────────────────────────────────────────────────

/**
 * DATA_ENCRYPTION_KEY — 32-byte base64 key for AES-256-GCM encryption.
 *
 * Used by encryption.ts for general-purpose field encryption (notes, etc.).
 * Lazy accessor: throws at request time in production if missing.
 */
export const DATA_ENCRYPTION_KEY = lazyEnv("DATA_ENCRYPTION_KEY");

/**
 * AADHAAR_ENCRYPTION_KEY — 32-byte key for AES-256-CBC Aadhaar encryption.
 *
 * Lazy accessor: throws at request time in production if missing.
 * Never throws at build time or module import time.
 *
 * No default value. No publicly known fallback.
 * Call AADHAAR_ENCRYPTION_KEY() inside encrypt/decrypt functions only.
 *
 * Development: warns if missing, returns "" (encryption skipped gracefully).
 * Production:  throws — missing key is a fatal runtime error, not a build error.
 */
export const AADHAAR_ENCRYPTION_KEY = lazyEnv("AADHAAR_ENCRYPTION_KEY");

// ─── Firebase Admin SDK (server-only) ────────────────────────────────────────

/**
 * Firebase Admin project ID — server-side only.
 */
export const FIREBASE_PROJECT_ID = lazyEnv("FIREBASE_PROJECT_ID");

/**
 * Firebase Admin client email — server-side only.
 */
export const FIREBASE_CLIENT_EMAIL = lazyEnv("FIREBASE_CLIENT_EMAIL");

/**
 * Firebase Admin private key — server-side only.
 * Raw value with literal \n — callers must replace with real newlines.
 */
export const FIREBASE_PRIVATE_KEY = lazyEnv("FIREBASE_PRIVATE_KEY");

/**
 * Super admin seed secret for initialization scripts.
 */
export const SUPER_ADMIN_SEED_SECRET = lazyEnv("SUPER_ADMIN_SEED_SECRET");

// ─── Startup validation (production fast-fail) ────────────────────────────────

/**
 * validateStartup() — Validates all critical environment variables.
 *
 * Call this once at application startup (e.g., in server.ts or instrumentation.ts).
 * In production: throws immediately if any critical var is absent.
 * In development: logs a summary of present/missing vars.
 *
 * Critical vars (app cannot function without these):
 *   - MONGODB_URI          — database connection
 *   - FIREBASE_PROJECT_ID  — auth (Firebase Admin)
 *   - FIREBASE_CLIENT_EMAIL
 *   - FIREBASE_PRIVATE_KEY
 *   - MAPPLS_API_KEY       — location and routing
 *   - OPENWEATHER_API_KEY  — weather intelligence
 *   - NEWS_API_KEY         — news disruption signals
 *   - DATA_ENCRYPTION_KEY  — field encryption
 */
export function validateStartup(): void {
  const critical: string[] = [
    "MONGODB_URI",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "MAPPLS_API_KEY",
    "OPENWEATHER_API_KEY",
    "NEWS_API_KEY",
    "TRAFFIC_API_KEY",
    "DATA_ENCRYPTION_KEY",
    "AADHAAR_ENCRYPTION_KEY",
  ];

  const missing: string[] = [];

  for (const key of critical) {
    const val = process.env[key];
    if (!val || val.trim() === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const list = missing.join(", ");
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `[SentinelRoute] STARTUP FAILURE — Missing critical environment variables: ${list}\n` +
        `Set these in your deployment environment and redeploy.`
      );
    } else {
      console.warn(`\n[SentinelRoute] ⚠️  Missing environment variables: ${list}\n`);
    }
  }
}

// ─── Env summary (dev only) ───────────────────────────────────────────────────

/**
 * Logs the presence/absence of all environment variables.
 * Only runs in development — suppressed in production.
 */
export function logEnvStatus(): void {
  if (process.env.NODE_ENV === "production") return;

  const vars = [
    // Firebase (public)
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    // Server secrets
    "MONGODB_URI",
    "OPENWEATHER_API_KEY",
    "GEMINI_API_KEY",
    "MAPPLS_API_KEY",
    "NEWS_API_KEY",
    "TRAFFIC_API_KEY",
    "DATA_ENCRYPTION_KEY",
    "AADHAAR_ENCRYPTION_KEY",
    // Firebase Admin
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ];

  console.log("\n[SentinelRoute] Environment check:");
  for (const key of vars) {
    const val = process.env[key];
    const status = val && val.trim() !== "" ? "✓" : "✗ MISSING";
    console.log(`  ${status}  ${key}`);
  }
  console.log("");
}
