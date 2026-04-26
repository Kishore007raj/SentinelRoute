/**
 * firebase-admin.ts — Firebase Admin SDK singleton + token verification.
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

// ─── Token verification ───────────────────────────────────────────────────────

export interface VerifiedUser {
  uid: string;
}

/**
 * Verifies a Firebase ID token from the Authorization header.
 *
 * Reads:  Authorization: Bearer <token>
 * Returns { uid } on success.
 * Throws a Response (401) when:
 *   - No Authorization header present
 *   - Token is missing, malformed, expired, or revoked
 *   - Admin SDK is not configured (cannot verify)
 *
 * Usage in API routes:
 *   const user = await verifyFirebaseToken(req);
 *   const userId = user.uid;
 */
export async function verifyFirebaseToken(req: Request): Promise<VerifiedUser> {
  const authHeader = req.headers.get("authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized: missing Authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized: empty token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Admin SDK not configured — cannot verify cryptographically
  if (!adminAuth) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized: authentication service not configured" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";

    // Known invalid-token codes → 401
    const invalidTokenCodes = [
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/invalid-id-token",
      "auth/argument-error",
      "auth/user-disabled",
    ];

    if (invalidTokenCodes.some((c) => code.startsWith(c))) {
      throw new Response(
        JSON.stringify({ error: `Unauthorized: ${code}` }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Unexpected Admin SDK error — re-throw for caller to handle as 503
    console.error("[firebase-admin] verifyFirebaseToken unexpected error:", code, err);
    throw err;
  }
}
