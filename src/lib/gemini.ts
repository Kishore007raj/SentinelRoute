/**
 * gemini.ts — Gemini AI client with hard 10s timeout.
 *
 * If Gemini fails or times out, returns a deterministic fallback
 * immediately — never blocks the UI.
 *
 * Rate-limit backoff: after a 429, we skip Gemini calls for 60 seconds
 * to avoid hammering the API and filling logs with warnings.
 */

import { GEMINI_API_KEY } from "./env";

const TIMEOUT_MS = 10_000;

// In-process cooldown after a 429 — avoids log spam and wasted quota
let rateLimitedUntil = 0;
const RATE_LIMIT_COOLDOWN_MS = 60_000; // 60 seconds

/**
 * Calls Gemini with a hard 10-second timeout.
 * Returns a deterministic fallback string on any failure — never throws.
 */
export async function generateExplanation(prompt: string): Promise<string | null> {
  const apiKey = GEMINI_API_KEY();
  if (!apiKey) return null;

  // Skip the call entirely if we're still in the post-429 cooldown window
  if (Date.now() < rateLimitedUntil) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.4 },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

    if (response.status === 429) {
      // Respect Retry-After header if present, otherwise default to 60s
      const retryAfter = response.headers.get("Retry-After");
      const cooldownMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_COOLDOWN_MS;
      rateLimitedUntil = Date.now() + cooldownMs;
      console.warn(`[gemini] Rate limited — cooling down for ${cooldownMs / 1000}s`);
      return null;
    }

    if (!response.ok) {
      console.warn(`[gemini] API error ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || null;

  } catch (err: unknown) {
    clearTimeout(timer);
    const name = (err as { name?: string }).name ?? "";
    if (name === "AbortError") {
      console.warn("[gemini] Request timed out after 10s");
    } else {
      console.error("[gemini] Fetch error:", err);
    }
    return null;
  }
}
