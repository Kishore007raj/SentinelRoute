"use client";
/**
 * AiInsightBox.tsx — Displays the Gemini AI route explanation.
 *
 * Shows a loading skeleton while the explanation is being fetched,
 * then animates in the text. Renders nothing if explanation is null.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface AiInsightBoxProps {
  explanation: string | null;
  loading: boolean;
}

export function AiInsightBox({ explanation, loading }: AiInsightBoxProps) {
  // Don't render if not loading and no explanation
  if (!loading && !explanation) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="ai-insight"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3 }}
        className="border border-primary/20 bg-primary/5 rounded-xl p-5 space-y-3"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-xs text-primary uppercase tracking-widest font-semibold">
            AI Insight
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
        </div>

        {/* Content */}
        {loading ? (
          // Skeleton
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
        ) : explanation ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-foreground/90 leading-relaxed"
          >
            {explanation}
          </motion.p>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
