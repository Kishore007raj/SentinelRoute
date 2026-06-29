import { auth } from "./firebase";

/**
 * A fetch wrapper that automatically injects the Firebase Authorization header.
 * Use this for all API requests to the SentinelRoute backend instead of raw fetch.
 */
export async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  // Attempt to get the current Firebase user token
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch (err) {
      console.warn("[api-client] Failed to get Firebase ID token:", err);
    }
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  return response;
}
