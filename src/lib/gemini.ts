/**
 * gemini.ts — Gemini AI client with hard 10s timeout.
 *
 * If Gemini fails or times out, returns a deterministic fallback
 * immediately — never blocks the UI.
 */

const TIMEOUT_MS = 10_000;

/**
 * Calls Gemini with a hard 10-second timeout.
 * Returns a deterministic fallback string on any failure — never throws.
 */
export async function generateExplanation(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

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
      console.warn("[gemini] Rate limited — returning null");
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
