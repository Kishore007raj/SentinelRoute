/**
 * festival-intelligence.ts — Festival congestion risk engine for India.
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
  startDate:            string;  // "MM-DD" (annual — no year)
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

// ─── Static festival calendar ─────────────────────────────────────────────────
// Dates as "MM-DD" — evaluated against current calendar year.
// National festivals use state: "national", affectedStates: ["all"].

const FESTIVAL_CALENDAR: FestivalEntry[] = [
  // ── National ──────────────────────────────────────────────────────────────
  {
    id: "republic-day",
    name: "Republic Day",
    state: "national",
    startDate: "01-26",
    endDate: "01-26",
    congestionMultiplier: 1.8,
    riskLevel: "high",
    affectedStates: ["all"],
  },
  {
    id: "independence-day",
    name: "Independence Day",
    state: "national",
    startDate: "08-15",
    endDate: "08-15",
    congestionMultiplier: 1.7,
    riskLevel: "high",
    affectedStates: ["all"],
  },
  {
    id: "gandhi-jayanti",
    name: "Gandhi Jayanti",
    state: "national",
    startDate: "10-02",
    endDate: "10-02",
    congestionMultiplier: 1.3,
    riskLevel: "medium",
    affectedStates: ["all"],
  },
  // ── Major Religious ────────────────────────────────────────────────────────
  {
    id: "diwali",
    name: "Diwali",
    state: "national",
    startDate: "10-20",
    endDate: "10-24",
    congestionMultiplier: 2.2,
    riskLevel: "critical",
    affectedStates: ["all"],
  },
  {
    id: "dussehra",
    name: "Dussehra",
    state: "national",
    startDate: "10-12",
    endDate: "10-12",
    congestionMultiplier: 1.9,
    riskLevel: "high",
    affectedStates: ["all"],
  },
  {
    id: "eid-ul-fitr",
    name: "Eid ul-Fitr",
    state: "national",
    startDate: "04-10",
    endDate: "04-11",
    congestionMultiplier: 2.0,
    riskLevel: "high",
    affectedStates: ["all"],
  },
  {
    id: "christmas",
    name: "Christmas",
    state: "national",
    startDate: "12-24",
    endDate: "12-26",
    congestionMultiplier: 1.6,
    riskLevel: "high",
    affectedStates: ["all"],
  },
  // ── South India / Regional ─────────────────────────────────────────────────
  {
    id: "pongal",
    name: "Pongal",
    state: "TN",
    startDate: "01-14",
    endDate: "01-17",
    congestionMultiplier: 2.0,
    riskLevel: "high",
    affectedStates: ["TN"],
  },
  {
    id: "onam",
    name: "Onam",
    state: "KL",
    startDate: "09-01",
    endDate: "09-13",
    congestionMultiplier: 1.9,
    riskLevel: "high",
    affectedStates: ["KL"],
  },
  {
    id: "ganesh-chaturthi",
    name: "Ganesh Chaturthi",
    state: "MH",
    startDate: "09-07",
    endDate: "09-17",
    congestionMultiplier: 2.1,
    riskLevel: "critical",
    affectedStates: ["MH", "KA", "TS", "AP"],
  },
  {
    id: "durga-puja",
    name: "Durga Puja",
    state: "WB",
    startDate: "10-01",
    endDate: "10-05",
    congestionMultiplier: 2.3,
    riskLevel: "critical",
    affectedStates: ["WB", "OR", "JH", "BR"],
  },
  {
    id: "holi",
    name: "Holi",
    state: "national",
    startDate: "03-24",
    endDate: "03-25",
    congestionMultiplier: 1.8,
    riskLevel: "high",
    affectedStates: ["all"],
  },
  {
    id: "navratri",
    name: "Navratri",
    state: "national",
    startDate: "10-03",
    endDate: "10-11",
    congestionMultiplier: 1.7,
    riskLevel: "high",
    affectedStates: ["all"],
  },
  {
    id: "ugadi",
    name: "Ugadi",
    state: "national",
    startDate: "04-09",
    endDate: "04-09",
    congestionMultiplier: 1.6,
    riskLevel: "medium",
    affectedStates: ["KA", "AP", "TS"],
  },
  {
    id: "bihu",
    name: "Bihu",
    state: "AS",
    startDate: "04-14",
    endDate: "04-15",
    congestionMultiplier: 1.5,
    riskLevel: "medium",
    affectedStates: ["AS"],
  },
  {
    id: "baisakhi",
    name: "Baisakhi",
    state: "PB",
    startDate: "04-13",
    endDate: "04-14",
    congestionMultiplier: 1.6,
    riskLevel: "medium",
    affectedStates: ["PB", "HR"],
  },
  {
    id: "vishu",
    name: "Vishu",
    state: "KL",
    startDate: "04-14",
    endDate: "04-14",
    congestionMultiplier: 1.6,
    riskLevel: "medium",
    affectedStates: ["KL"],
  },
  {
    id: "puthandu",
    name: "Puthandu",
    state: "TN",
    startDate: "04-14",
    endDate: "04-14",
    congestionMultiplier: 1.6,
    riskLevel: "medium",
    affectedStates: ["TN"],
  },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toMMDD(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}-${d}`;
}

function isDateInRange(dateMMDD: string, startMMDD: string, endMMDD: string): boolean {
  return dateMMDD >= startMMDD && dateMMDD <= endMMDD;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Returns festival risk contribution for the current date.
 * Optionally scoped to specific Indian states (ISO 3166-2:IN).
 *
 * @param companyId  For audit logging
 * @param shipmentId Optional shipment context
 * @param states     Optional: filter to specific states (e.g. ["TN", "KA"])
 * @param referenceDate Optional: override current date for testing
 */
export async function getFestivalRiskContribution(
  companyId:     string,
  shipmentId?:   string,
  states?:       string[],
  referenceDate?: Date
): Promise<FestivalRiskContribution> {
  const now = referenceDate ?? new Date();
  const todayMMDD = toMMDD(now);

  // Window: check festivals starting within +3 days (upcoming congestion)
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const windowEndMMDD = toMMDD(windowEnd);

  const db = await getDb();
  const col = db.collection<FestivalEntry>("festival_calendar");
  let allFestivals = await col.find({}).toArray();

  if (allFestivals.length === 0) {
    // Seed database if empty
    await Promise.all(
      FESTIVAL_CALENDAR.map((f) =>
        col.updateOne({ id: f.id }, { $set: f }, { upsert: true })
      )
    );
    allFestivals = await col.find({}).toArray();
  }

  const activeFestivals: FestivalEntry[] = allFestivals.filter((fest) => {
    // Is the festival currently active OR starting within 3 days?
    const isCurrentlyActive = isDateInRange(todayMMDD, fest.startDate, fest.endDate);
    const isUpcoming        = todayMMDD <= windowEndMMDD && windowEndMMDD >= fest.startDate;

    if (!isCurrentlyActive && !isUpcoming) return false;

    // State filter
    if (states && states.length > 0) {
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
          { $set: { ...f, lastChecked: new Date().toISOString() } },
          { upsert: true }
        )
      )
    );
  } catch (err) {
    console.error("[festival-intelligence] Persist failed:", err);
  }

  // ── Audit: festival_risk_added ─────────────────────────────────────────────
  createIntelligenceAudit({
    companyId,
    shipmentId,
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
 * Falls back to static list if DB is not available.
 */
export async function getFestivalCalendar(): Promise<FestivalEntry[]> {
  try {
    const db = await getDb();
    const festivals = await db.collection<FestivalEntry>("festival_calendar").find({}).toArray();
    if (festivals.length > 0) return festivals;
  } catch (err) {
    console.error("[festival-intelligence] DB fetch failed, returning static list");
  }
  return FESTIVAL_CALENDAR;
}
