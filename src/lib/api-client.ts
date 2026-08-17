/**
 * api-client.ts — Authenticated fetch wrapper for SentinelRoute.
 *
 * Automatically injects the Firebase ID token as an Authorization header.
 *
 * KEY BEHAVIOUR ON VERCEL / SERVERLESS:
 * When a page first loads, Firebase may not have restored auth.currentUser from
 * IndexedDB yet (takes ~200–500 ms). A naive check of `auth.currentUser` returns
 * null and the request is sent without a token → 401.
 *
 * This wrapper waits for the Firebase auth state to resolve before making the
 * request, so the token is always available on the first call.
 *
 * Timeout: 3 s. If Firebase hasn't resolved in 3 s, we proceed without the token
 * (the server will return 401, which is the correct behaviour for unauthenticated
 * requests — better than hanging forever).
 */

import { auth } from "./firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

// ── Wait for Firebase auth to settle ────────────────────────────────────────
// Returns the current user once the auth state is known, or null on timeout.
function waitForUser(timeoutMs = 3_000): Promise<User | null> {
  // Fast path: auth state already resolved (normal case after initial load)
  if (auth.currentUser !== undefined) {
    // auth.currentUser is explicitly null when signed out, non-null when signed in.
    // The `undefined` case only happens before onAuthStateChanged has fired once.
    // In practice this branch is hit on every call after the first page interaction.
    return Promise.resolve(auth.currentUser);
  }

  // Slow path: auth hasn't resolved yet — wait for the first state-change event.
  return new Promise<User | null>((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        resolve(null); // proceed without token on timeout
      }
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(user);
      }
    });
  });
}

/**
 * fetchApi — authenticated fetch for all API requests.
 *
 * - Waits for Firebase auth state before sending the request.
 * - Injects Authorization: Bearer <token> when the user is signed in.
 * - Falls through to an unauthenticated request if no user is found.
 * - Preserves all other RequestInit options unchanged.
 */
export async function fetchApi(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);

  const user = await waitForUser();
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch (err) {
      console.warn("[api-client] Failed to get Firebase ID token:", err);
    }
  }

  return fetch(input, { ...init, headers });
}
