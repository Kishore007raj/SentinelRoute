const FALLBACK = "AI unavailable. Showing system reasoning.";

export async function generateExplanation(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return FALLBACK;

  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (response.status === 429) {
        if (retries === maxRetries) break;
        console.warn(`Gemini 429 received. Retrying in 30s... (Attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        retries++;
        continue;
      }

      if (!response.ok) {
        return FALLBACK;
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || FALLBACK;
    } catch (error) {
      console.error("Gemini API Error:", error);
      return FALLBACK;
    }
  }

  return FALLBACK;
}
