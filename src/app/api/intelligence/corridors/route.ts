import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { CorridorStatistic } from "@/lib/types";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

// ─── Fallback seed data (shown only when DB has zero live predictions) ────────
// Represents known India freight corridors so the UI is never empty on a fresh install.
const FALLBACK_CORRIDORS: CorridorStatistic[] = [
  {
    corridorId: "corr-fallback-1",
    origin: "Chennai",
    destination: "Bengaluru",
    averageDelay: 45,
    riskHistory: [30, 35, 40, 25, 20, 50, 45],
    weatherTrend: "clear",
    incidentDensity: 20,
    roadQuality: 85,
    averageEtaVariance: 30,
    historicalReliability: 92,
    currentOperationalStatus: "optimal",
    confidence: 95,
  },
  {
    corridorId: "corr-fallback-2",
    origin: "Mumbai",
    destination: "Pune",
    averageDelay: 120,
    riskHistory: [80, 75, 85, 90, 60, 50, 45],
    weatherTrend: "rainy",
    incidentDensity: 80,
    roadQuality: 70,
    averageEtaVariance: 90,
    historicalReliability: 60,
    currentOperationalStatus: "disrupted",
    confidence: 88,
  },
  {
    corridorId: "corr-fallback-3",
    origin: "Hyderabad",
    destination: "Vijayawada",
    averageDelay: 20,
    riskHistory: [10, 15, 20, 10, 5, 10, 15],
    weatherTrend: "clear",
    incidentDensity: 5,
    roadQuality: 95,
    averageEtaVariance: 10,
    historicalReliability: 98,
    currentOperationalStatus: "optimal",
    confidence: 99,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveOperationalStatus(
  avgRisk: number
): CorridorStatistic["currentOperationalStatus"] {
  if (avgRisk >= 70) return "disrupted";
  if (avgRisk >= 40) return "warning";
  return "optimal";
}


function deriveWeatherTrend(
  avgWeatherConf: number
): CorridorStatistic["weatherTrend"] {
  if (avgWeatherConf < 40) return "stormy";
  if (avgWeatherConf < 60) return "rainy";
  if (avgWeatherConf < 80) return "foggy";
  return "clear";
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { userRecord, company } = await requireCompany(req as any);
    const isSuperAdmin = userRecord.role === "super_admin";

    let companyId = company.companyId;
    const url = new URL(req.url);
    const targetCompanyId = url.searchParams.get("companyId");
    if (isSuperAdmin && targetCompanyId) {
      companyId = targetCompanyId;
    }

    // ── Super admin cross-company read audit ─────────────────────────────────
    if (isSuperAdmin && targetCompanyId) {
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "CorridorsRoute",
        metadata: {
          companyIdViewed: companyId,
          endpoint:        "/api/intelligence/corridors",
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    }

    const db = await getDb();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // ── Live aggregation: route_predictions ⟶ joined with shipments ──────────
    const aggregated = await db.collection("route_predictions").aggregate([
      {
        $match: {
          companyId,
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $lookup: {
          from:         "shipments",
          localField:   "shipmentId",
          foreignField: "id",
          as:           "shipmentData",
        },
      },
      { $unwind: { path: "$shipmentData", preserveNullAndEmpty: false } },
      {
        $match: {
          "shipmentData.origin":      { $exists: true, $ne: "" },
          "shipmentData.destination": { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: {
            origin:      "$shipmentData.origin",
            destination: "$shipmentData.destination",
          },
          predictionCount:          { $sum: 1 },
          avgDelayProbability:      { $avg: "$delayProbability" },
          avgDisruptionProbability: { $avg: "$disruptionProbability" },
          avgEtaConfidence:         { $avg: "$etaConfidence" },
          avgWeatherConfidence:     { $avg: "$weatherConfidence" },
          avgTrafficStability:      { $avg: "$trafficStability" },
          avgIncidentDensity:       { $avg: "$incidentDensity" },
          avgCorridorVolatility:    { $avg: "$corridorVolatility" },
          recentRiskScores: {
            $push: { $subtract: [100, "$overallOperationalConfidence"] },
          },
        },
      },
      { $sort: { predictionCount: -1 } },
      { $limit: 20 },
    ]).toArray();

    // ── Map aggregation → CorridorStatistic ───────────────────────────────────
    const liveCorridors: CorridorStatistic[] = aggregated.map((row, idx) => {
      const avgRisk     = Math.round(100 - (row.avgEtaConfidence ?? 50));
      const riskHistory = (row.recentRiskScores as number[])
        .slice(-7)
        .map((v: number) => Math.round(v));

      return {
        corridorId:               `corr-live-${idx + 1}`,
        origin:                   row._id.origin as string,
        destination:              row._id.destination as string,
        averageDelay:             Math.round((row.avgDelayProbability ?? 0) * 0.6),
        riskHistory:              riskHistory.length >= 2 ? riskHistory : [...riskHistory, avgRisk],
        weatherTrend:             deriveWeatherTrend(row.avgWeatherConfidence ?? 80),
        incidentDensity:          Math.round(row.avgIncidentDensity ?? 0),
        roadQuality:              Math.round(row.avgTrafficStability ?? 80),
        averageEtaVariance:       Math.round(row.avgCorridorVolatility ?? 10),
        historicalReliability:    Math.round(row.avgEtaConfidence ?? 80),
        currentOperationalStatus: deriveOperationalStatus(avgRisk),
        confidence:               Math.min(99, Math.round(50 + (row.predictionCount as number) * 2)),
      };
    });

    // ── Manual entries from corridor_statistics collection ───────────────────
    const dbCorridors = await db
      .collection("corridor_statistics")
      .find({ $or: [{ companyId: null }, { companyId: { $exists: false } }, { companyId }] })
      .toArray();

    const manualCorridors: CorridorStatistic[] = dbCorridors.map(doc => {
      const { _id, ...rest } = doc;
      return rest as unknown as CorridorStatistic;
    });

    // ── Merge: live > manual > fallback ──────────────────────────────────────
    // If we have live aggregated data, use it. Only fall back to static seed
    // when there are zero predictions (fresh install).
    const baseCorridors =
      liveCorridors.length > 0
        ? [...liveCorridors, ...manualCorridors]
        : [...FALLBACK_CORRIDORS, ...manualCorridors];

    // Dedup by corridorId — first occurrence wins (live data takes priority)
    const uniqueCorridors = Array.from(
      new Map(baseCorridors.map(c => [c.corridorId, c])).values()
    );

    return NextResponse.json({
      corridors:    uniqueCorridors,
      source:       liveCorridors.length > 0 ? "live" : "fallback",
      basedOnCount: aggregated.reduce((s, r) => s + (r.predictionCount as number), 0),
      computedAt:   new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof Response) {
      return new NextResponse(err.body, {
        status:  err.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[GET /api/intelligence/corridors]", err);
    return NextResponse.json({ error: "Failed to fetch corridors" }, { status: 500 });
  }
}
