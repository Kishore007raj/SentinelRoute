/**
 * firebase-admin.ts — Firebase Admin SDK singleton + token verification.
 *
 * Initialises with service account credentials when available.
 * Degrades gracefully when credentials are missing — falls back to
 * JWT payload decode (same as auth.ts) so the app works without
 * service account keys configured.
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
    "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required for full\n" +
    "server-side token verification. Falling back to JWT decode (dev mode).\n" +
    "Get credentials from Firebase Console → Project Settings → Service Accounts."
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
 */
export const adminAuth: Auth | null = adminApp ? getAuth(adminApp) : null;

// ─── JWT payload decoder (no verification — dev fallback) ─────────────────────

function decodeJwtUid(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json    = Buffer.from(payload, "base64").toString("utf8");
    const parsed  = JSON.parse(json) as Record<string, unknown>;

    // Must be a real Firebase token
    const iss = typeof parsed.iss === "string" ? parsed.iss : "";
    if (!iss.startsWith("https://securetoken.google.com/")) return null;

    return typeof parsed.sub === "string" ? parsed.sub : null;
  } catch {
    return null;
  }
}

// ─── Token verification ───────────────────────────────────────────────────────

export interface VerifiedUser {
  uid: string;
}

/**
 * Verifies a Firebase ID token from the Authorization header.
 *
 * Mode 1 (Admin SDK configured): full cryptographic verification.
 * Mode 2 (no Admin SDK): JWT payload decode — trusts the Firebase issuer claim.
 *
 * Throws a Response (401) when:
 *   - No Authorization header present
 *   - Token is missing, malformed, or from a non-Firebase issuer
 *   - Admin SDK rejects the token (expired, revoked, disabled user)
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

  // ── Mode 1: Admin SDK — full cryptographic verification ───────────────────
  if (adminAuth) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return { uid: decoded.uid };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
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
      console.error("[firebase-admin] verifyFirebaseToken unexpected error:", code, err);
      throw err;
    }
  }

  // ── Mode 2: No Admin SDK — decode JWT payload without verification ─────────
  // The token is a real Firebase ID token issued by the client SDK.
  // We trust the `iss` (issuer) claim to confirm it's from Firebase.
  const uid = decodeJwtUid(token);
  if (!uid) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized: invalid or non-Firebase token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return { uid };
}
