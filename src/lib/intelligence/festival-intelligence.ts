/**
 * festival-intelligence.ts - Festival congestion risk engine for India.
 *
 * Provides festival-aware risk scoring for the prediction engine.
 * Each festival entry has a congestion multiplier and affected states.
 *
 * Festival risk contributes to:
 *   - Delay Probability
 *   - Disruption Probability
 *   - Operational Risk Score
 *
 * Collection: festival_calendar
 * Indexes: date range + state
 */

import { getDb } from "../mongodb";
import { createIntelligenceAudit } from "../intelligence-audit";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FestivalEntry {
  id:                   string;
  name:                 string;
  /** "national" | ISO 3166-2:IN state code e.g. "TN", "MH", "KL" */
  state:                "national" | string;
  startDate:            string;  // "MM-DD" (annual - no year)
  endDate:              string;  // "MM-DD"
  congestionMultiplier: number;  // 1.0 – 2.5
  riskLevel:            "low" | "medium" | "high" | "critical";
  affectedStates:       string[]; // ISO 3166-2:IN codes or ["all"]
}

export interface FestivalRiskContribution {
  festivalBonus:    number;  // 0–50 addition to delayProbability
  congestionScore:  number;  // 0–100 independent congestion score
  activeFestivals:  FestivalEntry[];
  riskLevel:        "low" | "medium" | "high" | "critical";
}



// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Returns festival risk contribution based on shipment dates and states.
 *
 * @param companyId  For audit logging
 * @param shipment   Shipment context for dates and locations
 * @param referenceDate Optional: override current date for testing
 */
export async function getFestivalRiskContribution(
  companyId:     string,
  shipment?:     Partial<{ id: string; plannedDeparture: string; plannedArrival: string; origin: string; destination: string }>,
  referenceDate?: Date
): Promise<FestivalRiskContribution> {
  const now = referenceDate ?? new Date();
  
  // Determine date window based on shipment or fallback to now
  let startDateStr = now.toISOString().split('T')[0];
  let endDateStr = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (shipment && shipment.plannedDeparture) {
    startDateStr = shipment.plannedDeparture.split('T')[0];
    if (shipment.plannedArrival) {
      endDateStr = shipment.plannedArrival.split('T')[0];
    } else {
      endDateStr = new Date(new Date(shipment.plannedDeparture).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
  }

  // Extract states from origin/destination if possible (assuming format "City, ST")
  const states: string[] = [];
  if (shipment) {
    if (shipment.origin && shipment.origin.includes(',')) {
      const parts = shipment.origin.split(',');
      states.push(parts[parts.length - 1].trim().substring(0, 2).toUpperCase());
    }
    if (shipment.destination && shipment.destination.includes(',')) {
      const parts = shipment.destination.split(',');
      states.push(parts[parts.length - 1].trim().substring(0, 2).toUpperCase());
    }
  }

  const db = await getDb();
  const col = db.collection<FestivalEntry>("festivals");
  
  // Find festivals that overlap with the date window
  // For a festival to overlap, its startDate must be <= our endDate, and its endDate >= our startDate
  // Since dates in DB might be full YYYY-MM-DD or MM-DD, let's just fetch all active festivals
  // Wait, if we seeded full dates for 2026, we can do a query.
  // Actually, to support both MM-DD and YYYY-MM-DD, let's fetch all and filter in memory.
  const allFestivals = await col.find({}).toArray();

  const activeFestivals: FestivalEntry[] = allFestivals.filter((fest) => {
    // Is the festival overlapping?
    // Handle YYYY-MM-DD or MM-DD. If MM-DD, append the year from startDateStr
    const festStart = fest.startDate.length === 5 ? `${startDateStr.substring(0, 4)}-${fest.startDate}` : fest.startDate;
    const festEnd = fest.endDate.length === 5 ? `${startDateStr.substring(0, 4)}-${fest.endDate}` : fest.endDate;

    const isOverlapping = startDateStr <= festEnd && endDateStr >= festStart;

    if (!isOverlapping) return false;

    // State filter
    if (states.length > 0) {
      return (
        fest.affectedStates.includes("all") ||
        states.some((s) => fest.affectedStates.includes(s))
      );
    }

    return true;
  });

  if (activeFestivals.length === 0) {
    return {
      festivalBonus:   0,
      congestionScore: 0,
      activeFestivals: [],
      riskLevel:       "low",
    };
  }

  // Aggregate: take the maximum congestion multiplier and sum bonuses
  const maxMultiplier = Math.max(...activeFestivals.map((f) => f.congestionMultiplier));
  const festivalBonus = Math.min(
    50,
    activeFestivals.reduce((acc, f) => acc + Math.round((f.congestionMultiplier - 1.0) * 15), 0)
  );

  const congestionScore = Math.min(100, Math.round((maxMultiplier - 1.0) / 1.5 * 100));

  const highestRisk = activeFestivals.reduce((worst, f) => {
    const order = { low: 0, medium: 1, high: 2, critical: 3 };
    return order[f.riskLevel] > order[worst] ? f.riskLevel : worst;
  }, "low" as FestivalEntry["riskLevel"]);

  // Persist active festivals updates (idempotent)
  try {
    await Promise.all(
      activeFestivals.map((f) =>
        col.updateOne(
          { id: f.id },
          { $set: { ...f, lastChecked: new Date().toISOString() } }
        )
      )
    );
  } catch (err) {
    console.error("[festival-intelligence] Persist failed:", err);
  }

  // ── Audit: festival_risk_added ─────────────────────────────────────────────
  createIntelligenceAudit({
    companyId,
    shipmentId: shipment?.id,
    eventType: "festival_risk_added",
    source:    "FestivalIntelligence",
    metadata: {
      activeFestivals: activeFestivals.map((f) => ({ id: f.id, name: f.name, riskLevel: f.riskLevel })),
      festivalBonus,
      congestionScore,
      highestRisk,
    },
  }).catch(() => {});

  return {
    festivalBonus,
    congestionScore,
    activeFestivals,
    riskLevel: highestRisk,
  };
}

/**
 * Returns the full festival calendar from the database (for API exposure / admin view).
 */
export async function getFestivalCalendar(): Promise<FestivalEntry[]> {
  try {
    const db = await getDb();
    const festivals = await db.collection<FestivalEntry>("festivals").find({}).toArray();
    return festivals;
  } catch (err) {
    console.error("[festival-intelligence] DB fetch failed");
    return [];
  }
}

