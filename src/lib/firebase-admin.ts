/**
 * firebase-admin.ts — Firebase Admin SDK singleton.
 *
 * Initialises with service account credentials when available.
 * Degrades gracefully when credentials are missing — the app starts
 * normally and token verification returns null for all requests.
 *
 * Required env vars (server-only, never NEXT_PUBLIC_):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (newlines encoded as \n in .env.local)
 *
 * Get these from Firebase Console → Project Settings → Service Accounts
 * → Generate new private key → copy projectId, client_email, private_key.
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// ─── Env check ────────────────────────────────────────────────────────────────

const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// .env.local stores \n as literal backslash-n — replace with real newlines
const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const isConfigured = !!(projectId && clientEmail && privateKey);

if (!isConfigured && typeof window === "undefined") {
  console.warn(
    "[firebase-admin] Service account credentials not set.\n" +
    "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required for server-side\n" +
    "token verification. Get them from Firebase Console → Project Settings →\n" +
    "Service Accounts → Generate new private key.\n" +
    "Until then, all authenticated API routes will return empty data or 401."
  );
}

// ─── Singleton initialisation ─────────────────────────────────────────────────

function initAdmin(): App | null {
  if (!isConfigured) return null;

  const existing = getApps();
  if (existing.length > 0) return existing[0];

  return initializeApp({
    credential: cert({
      projectId:   projectId!,
      clientEmail: clientEmail!,
      privateKey:  privateKey!,
    }),
  });
}

const adminApp = initAdmin();

/**
 * Firebase Admin Auth instance.
 * null when service account credentials are not configured.
 * Check for null before calling verifyIdToken.
 */
export const adminAuth: Auth | null = adminApp ? getAuth(adminApp) : null;
