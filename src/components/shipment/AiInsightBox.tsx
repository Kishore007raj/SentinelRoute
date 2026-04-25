"use client";
/**
 * AiInsightBox.tsx — "Why this route?" explanation block.
 *
 * Always renders. Shows AI explanation when available, deterministic
 * fallback when Gemini is unavailable. Never returns null.
 *
 * Fallback structure: dominant factor → tradeoff → outcome.
 * All tradeoff logic delegated to route-utils.ts (single source of truth).
 */

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Brain } from "lucide-react";
import type { Route } from "@/lib/types";
import { buildTradeoffSentence } from "@/lib/route-utils";

interface AiInsightBoxProps {
  explanation: string | null;
  loading: boolean;
  route?: Route | null;
  cargoType?: string;
  urgency?: string;
  allRoutes?: Route[];
}

// ─── Deterministic fallback ───────────────────────────────────────────────────
// Structure: dominant factor → tradeoff → outcome

function buildFallbackExplanation(
  route: Route,
  cargoType?: string,
  urgency?: string,
  allRoutes?: Route[]
): string {
  const { label, riskScore, riskLevel, riskBreakdown, eta, distance } = route;
  // etaMinutes is used inside buildTradeoffSentence via route-utils — not needed here directly

  // 1. Dominant factor
  const sorted = Object.entries(riskBreakdown).sort(([, a], [, b]) => b - a);
  const [dominantKey, dominantVal] = sorted[0];
  const dominantName =
    dominantKey === "cargoSensitivity" ? "cargo sensitivity" :
    dominantKey === "traffic"          ? "traffic conditions" :
    dominantKey === "weather"          ? "weather conditions" :
    "route disruption";

  const dominantSentence =
    `The dominant risk factor on this corridor is ${dominantName} (${dominantVal}/100).`;

  // 2. Tradeoff — delegated to route-utils for semantic correctness and NaN safety
  const tradeoffSentence = buildTradeoffSentence(route, allRoutes ?? []);

  // 3. Outcome — cargo and urgency context
  let outcomeSentence = "";
  if (cargoType === "Pharmaceuticals" || cargoType === "Cold Chain Goods") {
    outcomeSentence = ` Temperature-sensitive cargo — delay variance is the critical outcome to minimise.`;
  } else if (cargoType === "Electronics") {
    outcomeSentence = ` Electronics cargo is sensitive to handling disruptions; lower disruption score reduces exposure.`;
  } else if (urgency === "Critical") {
    outcomeSentence = ` Critical urgency — arrival time is the primary outcome; risk score ${riskScore}/100 is accepted.`;
  } else if (urgency === "Priority") {
    outcomeSentence = ` Priority urgency applies a 1.2× risk multiplier — final score reflects elevated sensitivity.`;
  } else {
    outcomeSentence = ` Overall ${riskLevel} risk (${riskScore}/100) for this ${eta}, ${distance} corridor.`;
  }

  return dominantSentence + tradeoffSentence + outcomeSentence;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AiInsightBox({ explanation, loading, route, cargoType, urgency, allRoutes }: AiInsightBoxProps) {
  const fallback    = route ? buildFallbackExplanation(route, cargoType, urgency, allRoutes) : null;
  const displayText = explanation ?? fallback;
  const isAi        = !!explanation;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={loading ? "loading" : isAi ? "ai" : "fallback"}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3 }}
        className="border border-primary/20 bg-primary/5 rounded-xl p-5 space-y-3"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            {isAi ? (
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Brain className="w-3.5 h-3.5 text-primary" />
            )}
          </div>
          <p className="text-xs text-primary uppercase tracking-widest font-semibold">
            Why this route?
          </p>
          {loading && (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="ml-auto text-[10px] text-primary/60 uppercase tracking-widest"
            >
              Analyzing...
            </motion.div>
          )}
          {!loading && (
            <span className="ml-auto text-[10px] text-muted-foreground/50 uppercase tracking-widest">
              {isAi ? "AI" : "System"}
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[100, 85, 60].map((w, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.15 }}
                className="h-3 bg-primary/15 rounded-full"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        ) : displayText ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-foreground/90 leading-relaxed"
          >
            {displayText}
          </motion.p>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
