/**
 * env.ts — Validated environment variable accessor.
 *
 * NEXT_PUBLIC_ variables are validated at import time (they are inlined
 * at build time by Next.js and must be present).
 *
 * Server-only secrets (AADHAAR_ENCRYPTION_KEY, OPENWEATHER_API_KEY,
 * GEMINI_API_KEY) are validated lazily — only when first accessed at
 * request time, never during the Next.js build phase.
 *
 * This prevents "Missing required environment variable" errors during
 * `next build` when secrets are intentionally absent from the build
 * environment and only injected at runtime by the hosting platform.
 */

// ─── Build-time helper (NEXT_PUBLIC_ vars only) ───────────────────────────────

/**
 * Validates a NEXT_PUBLIC_ variable at import time.
 * These are inlined by the bundler and MUST be present at build time.
 */
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
 * OpenWeather API key — server-side only.
 * Call OPENWEATHER_API_KEY() inside a request handler, never at top level.
 */
export const OPENWEATHER_API_KEY = lazyEnv("OPENWEATHER_API_KEY");

/**
 * Google Gemini API key — server-side only.
 * Call GEMINI_API_KEY() inside a request handler, never at top level.
 */
export const GEMINI_API_KEY = lazyEnv("GEMINI_API_KEY");

// ─── Aadhaar encryption key ───────────────────────────────────────────────────

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

// ─── Env summary (dev only) ───────────────────────────────────────────────────

/**
 * Logs the presence/absence of all environment variables.
 * Only runs in development — suppressed in production.
 */
export function logEnvStatus(): void {
  if (process.env.NODE_ENV === "production") return;

  const vars = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "OPENWEATHER_API_KEY",
    "GEMINI_API_KEY",
    "AADHAAR_ENCRYPTION_KEY",
  ];

  console.log("\n[SentinelRoute] Environment check:");
  for (const key of vars) {
    const val = process.env[key];
    const status = val && val.trim() !== "" ? "✓" : "✗ MISSING";
    console.log(`  ${status}  ${key}`);
  }
  console.log("");
}
