import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { RiskLevel } from "./mock-data"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRiskColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "low": return "text-emerald-400"
    case "medium": return "text-amber-400"
    case "high": return "text-red-400"
    case "critical": return "text-red-600"
  }
}

export function getRiskBgColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "low": return "bg-emerald-400/10 border-emerald-400/20"
    case "medium": return "bg-amber-400/10 border-amber-400/20"
    case "high": return "bg-red-400/10 border-red-400/20"
    case "critical": return "bg-red-600/10 border-red-600/20"
  }
}

export function getRiskLabel(score: number): RiskLevel {
  if (score <= 30) return "low"
  if (score <= 60) return "medium"
  if (score <= 80) return "high"
  return "critical"
}

export function formatRiskScore(score: number): string {
  return score.toString().padStart(2, "0")
}

export function generateShipmentCode(): string {
  const num = Math.floor(Math.random() * 900) + 100
  return `SR-2026-0${num}`
}
