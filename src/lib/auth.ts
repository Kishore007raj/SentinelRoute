/**
 * auth.ts — Server-side auth helpers.
 *
 * TWO MODES:
 *
 * 1. Firebase Admin configured (FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL +
 *    FIREBASE_PRIVATE_KEY set in .env.local):
 *    → Fully verifies the ID token cryptographically.
 *    → Use this in production.
 *
 * 2. Firebase Admin NOT configured (service account keys missing):
 *    → Decodes the JWT payload without verification to extract the UID.
 *    → Sufficient for development — the client is already authenticated
 *      via Firebase client SDK, and the token is a real Firebase JWT.
 *    → NOT safe as a standalone auth mechanism in production.
 *
 * In both modes the function returns:
 *   string  — the Firebase UID
 *   null    — no/invalid Authorization header
 * And throws only on unexpected Admin SDK errors (callers return 503).
 */

import { adminAuth } from "./firebase-admin";

// ─── JWT payload decoder (no verification) ───────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → base64 → JSON
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json    = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // ── Mode 1: Admin SDK available — full cryptographic verification ──────────
  if (adminAuth) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return decoded.uid;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
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
      console.error("[auth] verifyIdToken unexpected error:", code, err);
      throw err;
    }
  }

  // ── Mode 2: No Admin SDK — decode JWT payload without verification ─────────
  // The token is a real Firebase ID token issued by the client SDK.
  // We trust the `sub` (subject) claim as the UID.
  // Add FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY to .env.local for
  // full verification in production.
  const payload = decodeJwtPayload(token);
  if (!payload) {
    console.debug("[auth] Could not decode JWT payload");
    return null;
  }

  const uid = typeof payload.sub === "string" ? payload.sub : null;
  if (!uid) {
    console.debug("[auth] JWT payload missing 'sub' claim");
    return null;
  }

  // Sanity check: ensure this looks like a Firebase token
  const iss = typeof payload.iss === "string" ? payload.iss : "";
  if (!iss.startsWith("https://securetoken.google.com/")) {
    console.debug("[auth] JWT issuer is not Firebase — rejecting");
    return null;
  }

  return uid;
}
