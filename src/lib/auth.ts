/**
 * auth.ts — Server-side auth helpers.
 *
 * Verifies Firebase ID tokens sent as `Authorization: Bearer <token>` headers.
 * Returns the Firebase UID on success, null on an invalid/missing token.
 *
 * When Firebase Admin is not configured (missing service account credentials),
 * all requests are treated as unauthenticated — returns null without throwing.
 */

import { adminAuth } from "./firebase-admin";

/**
 * Extracts and verifies the Firebase ID token from the Authorization header.
 *
 * @returns Firebase UID if the token is valid.
 * @returns null if the header is absent, the token is invalid/expired,
 *          or the Admin SDK is not configured.
 * @throws  if the Admin SDK is configured but fails unexpectedly
 *          (network error, etc.) — callers return 503.
 */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // Admin SDK not configured — treat all requests as unauthenticated
  if (!adminAuth) return null;

  const authHeader = req.headers.get("authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";

    // Expected "bad token" errors — treat as unauthenticated
    const expectedCodes = [
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/invalid-id-token",
      "auth/argument-error",
      "auth/user-disabled",
    ];

    if (expectedCodes.some((c) => code.startsWith(c))) {
      console.debug(`[auth] Token rejected: ${code}`);
      return null;
    }

    // Unexpected error — re-throw so API routes can return 503
    console.error("[auth] verifyIdToken unexpected error:", code, err);
    throw err;
  }
}
