import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RiskLevel } from "./types"

/**
 * Utility for Tailwind CSS class merging
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns consistent text colors for risk levels
 */
export function getRiskColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "low": return "text-emerald-400"
    case "medium": return "text-amber-400"
    case "high": return "text-red-400"
    case "critical": return "text-red-600"
    default: return "text-muted-foreground"
  }
}

/**
 * Returns consistent background and border colors for risk levels
 */
export function getRiskBgColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "low": return "bg-emerald-400/10 border-emerald-400/20"
    case "medium": return "bg-amber-400/10 border-amber-400/20"
    case "high": return "bg-red-400/10 border-red-400/20"
    case "critical": return "bg-red-600/10 border-red-600/20"
    default: return "bg-muted/10 border-border/20"
  }
}

/**
 * Derives risk level from a numeric score
 */
export function getRiskLabel(score: number): RiskLevel {
  if (score > 75) return "critical"
  if (score > 50) return "high"
  if (score > 25) return "medium"
  return "low"
}

/**
 * Formats risk score to be always 2 digits
 */
export function formatRiskScore(score: number): string {
  return score.toString().padStart(2, "0")
}
