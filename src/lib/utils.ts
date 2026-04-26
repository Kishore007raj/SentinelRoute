import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RiskLevel } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats an ISO timestamp as a human-readable relative string.
 * e.g. "2 min ago", "1 hr ago", "3 days ago"
 * Falls back to the raw string if parsing fails.
 */
export function formatRelativeTime(isoString: string | undefined): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)   return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
}

export function getRiskColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "low":      return "text-emerald-400"
    case "medium":   return "text-amber-400"
    case "high":     return "text-red-400"
    case "critical": return "text-red-600"
  }
}

/**
 * Returns the predictive alert only if it's a real, meaningful alert.
 * Filters out generic fallback strings that were saved to the DB
 * before the fix (e.g. "Monitor route conditions").
 */
const GENERIC_ALERTS = new Set([
  "monitor route conditions",
  "monitoring route conditions",
]);

export function getMeaningfulAlert(alert: string | undefined): string | undefined {
  if (!alert) return undefined;
  if (GENERIC_ALERTS.has(alert.toLowerCase().trim())) return undefined;
  return alert;
}

export function getRiskBgColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "low":      return "bg-emerald-400/10 border-emerald-400/20"
    case "medium":   return "bg-amber-400/10 border-amber-400/20"
    case "high":     return "bg-red-400/10 border-red-400/20"
    case "critical": return "bg-red-600/10 border-red-600/20"
  }
}

/**
 * Converts a numeric risk score (0–100) to a RiskLevel.
 * Thresholds match risk.ts: >75 critical, >50 high, >25 medium, else low.
 */
export function getRiskLabel(score: number): RiskLevel {
  if (score > 75) return "critical"
  if (score > 50) return "high"
  if (score > 25) return "medium"
  return "low"
}

export function formatRiskScore(score: number): string {
  return score.toString().padStart(2, "0")
}

/** Generates a random shipment code like SR-2026-0412 */
export function generateShipmentCode(): string {
  const num = Math.floor(Math.random() * 900) + 100
  return `SR-2026-0${num}`
}
