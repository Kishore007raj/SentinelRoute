/**
 * firebase-admin.ts - Firebase Admin SDK singleton + token verification.
 *
 * IMPORTANT: All initialization is LAZY - nothing runs at module import time.
 * This prevents build failures when env vars are not available in SSR workers.
 *
 * Required env vars (server-only, never NEXT_PUBLIC_):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (newlines encoded as \n in .env.local)
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } from "./env";

// ─── JWT payload decoder (no Admin SDK - dev fallback) ───────────────────────

function decodeJwtUid(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json    = Buffer.from(payload, "base64").toString("utf8");
    const parsed  = JSON.parse(json) as Record<string, unknown>;
    const iss = typeof parsed.iss === "string" ? parsed.iss : "";
    if (!iss.startsWith("https://securetoken.google.com/")) return null;
    return typeof parsed.sub === "string" ? parsed.sub : null;
  } catch {
    return null;
  }
}

// ─── Lazy singleton ───────────────────────────────────────────────────────────
// Never called at module evaluation time - only on the first request.

let _adminAuth: Auth | null | undefined = undefined; // undefined = not yet initialized

function getAdminAuth(): Auth | null {
  // Already resolved
  if (_adminAuth !== undefined) return _adminAuth;

  try {
    const projectId   = FIREBASE_PROJECT_ID();
    const clientEmail = FIREBASE_CLIENT_EMAIL();
    const rawKey      = FIREBASE_PRIVATE_KEY();
    // .env.local stores \n as literal backslash-n - convert to real newlines
    const privateKey  = rawKey ? rawKey.replace(/\\n/g, "\n") : "";

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        "[firebase-admin] Credentials not set - falling back to JWT decode (dev mode).\n" +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
      );
      _adminAuth = null;
      return null;
    }

    const existing = getApps();
    const app = existing.length > 0
      ? existing[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

    _adminAuth = getAuth(app);
    return _adminAuth;
  } catch (err) {
    // Invalid credentials (e.g. malformed PEM) - degrade gracefully
    console.warn("[firebase-admin] Failed to initialize Admin SDK:", err);
    _adminAuth = null;
    return null;
  }
}

// ─── Public exports ───────────────────────────────────────────────────────────

/**
 * getAdminAuth() - Lazily initializes and returns the Firebase Admin Auth instance.
 * Returns null if credentials are not configured or invalid.
 * Safe to call at any time including during request handling.
 */
export { getAdminAuth };

/**
 * adminAuth - kept for backward compatibility with existing imports.
 * Always null at module import time. Use getAdminAuth() for runtime access.
 * @deprecated Import getAdminAuth instead.
 */
export const adminAuth = null as null;

// ─── Token verification ───────────────────────────────────────────────────────

export interface VerifiedUser {
  uid: string;
}

/**
 * Verifies a Firebase ID token from the Authorization header.
 * Lazily initializes Firebase Admin on first call.
 *
 * Mode 1 (Admin SDK configured): full cryptographic verification.
 * Mode 2 (no Admin SDK): JWT payload decode - trusts the Firebase issuer claim.
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

  const auth = getAdminAuth();

  // ── Mode 1: Admin SDK ─────────────────────────────────────────────────────
  if (auth) {
    try {
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      const invalidCodes = [
        "auth/id-token-expired",
        "auth/id-token-revoked",
        "auth/invalid-id-token",
        "auth/argument-error",
        "auth/user-disabled",
      ];
      if (invalidCodes.some((c) => code.startsWith(c))) {
        throw new Response(
          JSON.stringify({ error: `Unauthorized: ${code}` }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      console.error("[firebase-admin] verifyFirebaseToken unexpected error:", code, err);
      throw err;
    }
  }

  // ── Mode 2: JWT decode fallback ───────────────────────────────────────────
  const uid = decodeJwtUid(token);
  if (!uid) {
    throw new Response(
      JSON.stringify({ error: "Unauthorized: invalid or non-Firebase token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return { uid };
}
