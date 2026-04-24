/**
 * env.ts — Validated environment variable accessor.
 *
 * All variables are validated at import time.
 * Missing required variables throw immediately so the app fails fast
 * rather than silently using undefined values at runtime.
 *
 * NEXT_PUBLIC_ variables are safe to use on the client.
 * All others are server-only.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    // Warn in development so the app still starts while keys are being filled in.
    // In production, throw immediately.
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
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key]?.trim() ?? fallback;
}

// ─── Firebase (client-safe, NEXT_PUBLIC_) ─────────────────────────────────────

export const firebaseConfig = {
  apiKey:            requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain:        requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId:         requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket:     requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId:             requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
} as const;

// ─── Server-only API keys ─────────────────────────────────────────────────────

/** Google Maps Routes API key — server-side only */
export const GOOGLE_MAPS_API_KEY = requireEnv("GOOGLE_MAPS_API_KEY");

/** OpenWeather API key — server-side only */
export const OPENWEATHER_API_KEY = requireEnv("OPENWEATHER_API_KEY");

/** Google Gemini API key — server-side only */
export const GEMINI_API_KEY = requireEnv("GEMINI_API_KEY");

// ─── Env summary (dev only) ───────────────────────────────────────────────────

/**
 * Call this once at app startup (e.g. in layout.tsx server component)
 * to confirm all env vars loaded correctly.
 * Logs are suppressed in production.
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
    "GOOGLE_MAPS_API_KEY",
    "OPENWEATHER_API_KEY",
    "GEMINI_API_KEY",
  ];

  console.log("\n[SentinelRoute] Environment check:");
  for (const key of vars) {
    const val = process.env[key];
    const status = val && val.trim() !== "" ? "✓" : "✗ MISSING";
    console.log(`  ${status}  ${key}`);
  }
  console.log("");
}
