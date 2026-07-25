"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface HealthGaugeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showValue?: boolean;
}

export function HealthGauge({
  score,
  label = "Operational Health",
  size = "md",
  showValue = true,
}: HealthGaugeProps) {
  const normalizedScore = Math.max(0, Math.min(100, score));

  // Determine color based on score thresholds (similar to existing logic in HealthScore)
  const color = useMemo(() => {
    if (normalizedScore >= 90) return "var(--sr-emerald)";
    if (normalizedScore >= 70) return "var(--sr-amber)";
    return "var(--sr-danger)";
  }, [normalizedScore]);

  // Glow color (matching globals.css tokens)
  const glow = useMemo(() => {
    if (normalizedScore >= 90) return "0 0 20px oklch(0.75 0.18 160 / 0.28)"; // emerald
    if (normalizedScore >= 70) return "0 0 20px oklch(0.80 0.20 70 / 0.28)";  // amber
    return "0 0 20px oklch(0.70 0.22 25 / 0.28)";                            // danger
  }, [normalizedScore]);

  const sizeMap = {
    sm: { radius: 24, stroke: 4, font: "text-sm", labelFont: "text-[10px]" },
    md: { radius: 40, stroke: 6, font: "text-2xl", labelFont: "text-xs" },
    lg: { radius: 64, stroke: 8, font: "text-4xl", labelFont: "text-sm" },
    xl: { radius: 80, stroke: 12, font: "text-5xl", labelFont: "text-base" },
  };

  const currentSize = sizeMap[size];
  const circumference = 2 * Math.PI * currentSize.radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;
  const viewBoxSize = (currentSize.radius + currentSize.stroke) * 2;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative flex items-center justify-center">
        <svg
          width={viewBoxSize}
          height={viewBoxSize}
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={viewBoxSize / 2}
            cy={viewBoxSize / 2}
            r={currentSize.radius}
            fill="transparent"
            stroke="var(--muted)"
            strokeWidth={currentSize.stroke}
          />
          {/* Foreground circle with animation */}
          <motion.circle
            cx={viewBoxSize / 2}
            cy={viewBoxSize / 2}
            r={currentSize.radius}
            fill="transparent"
            stroke={color}
            strokeWidth={currentSize.stroke}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(${glow})` }}
          />
        </svg>

        {showValue && (
          <div className="absolute flex flex-col items-center justify-center">
            <span className={`${currentSize.font} font-bold`} style={{ color }}>
              {normalizedScore.toFixed(0)}
            </span>
          </div>
        )}
      </div>

      {label && (
        <span className={`${currentSize.labelFont} text-muted-foreground font-semibold uppercase tracking-wider`}>
          {label}
        </span>
      )}
    </div>
  );
}
