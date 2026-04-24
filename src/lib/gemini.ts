/**
 * gemini.ts — Google Gemini AI client for SentinelRoute.
 *
 * Generates a concise, professional route decision explanation
 * that an operations manager can use to justify their routing choice.
 *
 * Uses Gemini 2.0 Flash (fast, cost-effective for short explanations).
 * API docs: https://ai.google.dev/api/generate-content
 *
 * Server-side only — uses GEMINI_API_KEY (no NEXT_PUBLIC_ prefix).
 */

import type { Route, RiskBreakdown } from "./types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ─── Request / Response types ─────────────────────────────────────────────────

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiPart[];
  role?: "user" | "model";
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  };
  systemInstruction?: {
    parts: GeminiPart[];
  };
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string; code: number };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

interface RouteContext {
  origin: string;
  destination: string;
  cargoType: string;
  vehicleType: string;
  urgency: string;
  selectedRoute: Route;
  allRoutes: Route[];
  weatherScore: number;
}

function buildPrompt(ctx: RouteContext): string {
  const { selectedRoute: r, allRoutes, origin, destination, cargoType, vehicleType, urgency } = ctx;

  const breakdown = r.riskBreakdown;
  const dominantFactor = getDominantFactor(breakdown);

  const alternatives = allRoutes
    .filter((alt) => alt.id !== r.id)
    .map((alt) => `${alt.label} (risk: ${alt.riskScore}, ETA: ${alt.eta})`)
    .join(", ");

  return `You are a logistics risk analyst for SentinelRoute, a professional route intelligence platform.

A shipment has been configured with the following parameters:
- Route: ${origin} → ${destination}
- Cargo: ${cargoType}
- Vehicle: ${vehicleType}
- Urgency: ${urgency}

The selected route is: ${r.name}
- Risk score: ${r.riskScore}/100 (${r.riskLevel} risk)
- ETA: ${r.eta}
- Distance: ${r.distance}
- Risk breakdown:
  • Traffic: ${breakdown.traffic}/100
  • Weather: ${breakdown.weather}/100
  • Disruption: ${breakdown.disruption}/100
  • Cargo sensitivity: ${breakdown.cargoSensitivity}/100
- Active alerts: ${r.alerts.length > 0 ? r.alerts.join("; ") : "none"}
- Alternatives considered: ${alternatives}

Write a 2–3 sentence professional explanation of why this route was selected or flagged. 
Focus on: the dominant risk factor (${dominantFactor}), what it means for this specific cargo type, and one actionable recommendation for the operations team.
Be direct and specific. Do not use generic phrases like "it is important to note". Write as if briefing a senior logistics manager.`;
}

function getDominantFactor(breakdown: RiskBreakdown): string {
  const factors = [
    { name: "traffic congestion", score: breakdown.traffic },
    { name: "weather conditions", score: breakdown.weather },
    { name: "route disruption", score: breakdown.disruption },
    { name: "cargo sensitivity", score: breakdown.cargoSensitivity },
  ];
  factors.sort((a, b) => b.score - a.score);
  return factors[0]?.name ?? "overall risk";
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Generates an AI explanation for a route selection using Gemini.
 *
 * Returns null if:
 * - GEMINI_API_KEY is not set
 * - API call fails
 *
 * Caller should handle null gracefully (no explanation shown).
 */
export async function generateRouteExplanation(
  ctx: RouteContext
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("[gemini] GEMINI_API_KEY not set — skipping AI explanation");
    return null;
  }

  const prompt = buildPrompt(ctx);

  const requestBody: GeminiRequest = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature:      0.4,   // focused, not creative
      maxOutputTokens:  200,   // 2–3 sentences max
      topP:             0.8,
    },
    systemInstruction: {
      parts: [{
        text: "You are a concise, professional logistics risk analyst. Always respond in 2–3 sentences. Never use bullet points. Never start with 'I' or 'The route'. Be direct and actionable.",
      }],
    },
  };

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[gemini] API error ${res.status}:`, errText);
      return null;
    }

    const data: GeminiResponse = await res.json();

    if (data.error) {
      console.error("[gemini] API returned error:", data.error.message);
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      console.warn("[gemini] Empty response from API");
      return null;
    }

    console.log(`[gemini] Generated explanation (${text.length} chars) for ${ctx.origin} → ${ctx.destination}`);
    return text;
  } catch (err) {
    console.error("[gemini] Fetch failed:", err);
    return null;
  }
}
