import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { CorridorStatistic } from "@/lib/types";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

interface RiskDoc {
  weatherRisk?: number;
  trafficRisk?: number;
  festivalRiskScore?: number;
  newsDisruptionBonus?: number;
  newsDelayBonus?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveOperationalStatus(avgRisk: number): CorridorStatistic["currentOperationalStatus"] {
  if (avgRisk >= 70) return "disrupted";
  if (avgRisk >= 40) return "warning";
  return "optimal";
}

function deriveWeatherTrend(weatherRisk: number): CorridorStatistic["weatherTrend"] {
  if (weatherRisk > 60) return "stormy";
  if (weatherRisk > 30) return "rainy";
  if (weatherRisk > 10) return "foggy";
  return "clear";
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { userRecord, company } = await requireCompany(req);
    const isSuperAdmin = userRecord.role === "super_admin";

    let companyId = company.companyId;
    const url = new URL(req.url);
    const targetCompanyId = url.searchParams.get("companyId");
    if (isSuperAdmin && targetCompanyId) {
      companyId = targetCompanyId;
    }

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

    // ── Live aggregation: shipments ⟶ risk_calculations & timeline ──────────
    const aggregated = await db.collection("shipments").aggregate([
      {
        $match: {
          companyId,
          origin: { $exists: true, $ne: "" },
          destination: { $exists: true, $ne: "" },
        },
      },
      {
        $lookup: {
          from:         "risk_calculations",
          localField:   "id",
          foreignField: "shipmentId",
          as:           "risks",
        },
      },
      {
        $lookup: {
          from:         "timeline_events",
          localField:   "id",
          foreignField: "shipmentId",
          as:           "timeline",
        },
      },
      {
        $group: {
          _id: {
            origin: "$origin",
            destination: "$destination",
          },
          shipmentCount: { $sum: 1 },
          completedShipments: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          delayedShipments: {
            $sum: { $cond: [{ $eq: ["$status", "at-risk"] }, 1, 0] }
          },
          avgRiskScore: { $avg: "$riskScore" },
          avgEtaMinutes: {
             // Try to approximate travel time if stored, else use default based on length
            $avg: { $ifNull: ["$etaMinutes", 120] }
          },
          // Push latest risk doc for granular metrics
          risksList: { $push: { $arrayElemAt: ["$risks", -1] } },
          // Flatten timeline events for reroute counts etc
          allTimelineEvents: { $push: "$timeline" }
        },
      },
      { $sort: { shipmentCount: -1 } },
      { $limit: 20 },
    ]).toArray();

    // ── Map aggregation → CorridorStatistic ───────────────────────────────────
    const liveCorridors: CorridorStatistic[] = aggregated.map((row, idx) => {
      const validRisks = (row.risksList || []).filter((r: RiskDoc | null): r is RiskDoc => r != null);
      const sumWeather  = validRisks.reduce((sum: number, r: RiskDoc) => sum + (r.weatherRisk ?? 0), 0);
      const sumTraffic  = validRisks.reduce((sum: number, r: RiskDoc) => sum + (r.trafficRisk ?? 0), 0);
      const sumFestival = validRisks.reduce((sum: number, r: RiskDoc) => sum + (r.festivalRiskScore ?? 0), 0);
      const sumNews     = validRisks.reduce((sum: number, r: RiskDoc) => sum + ((r.newsDisruptionBonus ?? 0) + (r.newsDelayBonus ?? 0)), 0);
      const riskCount   = validRisks.length || 1;

      const weatherRisk  = Math.round(sumWeather  / riskCount);
      const trafficRisk  = Math.round(sumTraffic  / riskCount);
      const festivalRisk = Math.round(sumFestival / riskCount);
      const newsRisk     = Math.round(sumNews     / riskCount);
      const avgRiskScore = Math.round(row.avgRiskScore || 0);

      let rerouteCount  = 0;
      let incidentCount = 0;
      (row.allTimelineEvents || []).forEach((events: Array<{ type: string }>) => {
        events.forEach(e => {
          if (e.type === "Route Changed" || e.type === "Suggested Reroute") rerouteCount++;
          if (e.type === "Incident Detected") incidentCount++;
        });
      });

      const historicalReliability = Math.max(0, 100 - avgRiskScore);
      const volatilityScore = Math.min(100, Math.round((trafficRisk + newsRisk + festivalRisk) * 0.7));
      const operationalHealth = Math.max(0, 100 - volatilityScore);

      const averageTravelTime = Math.round(row.avgEtaMinutes || 120);
      const averageEtaVariance = Math.round(avgRiskScore * 0.4); // rough approximation
      const averageDelay = Math.round((row.delayedShipments / (row.shipmentCount || 1)) * averageEtaVariance);

      return {
        corridorId:               `corr-live-${idx + 1}`,
        origin:                   row._id.origin as string,
        destination:              row._id.destination as string,
        shipmentCount:            row.shipmentCount,
        completedShipments:       row.completedShipments,
        delayedShipments:         row.delayedShipments,
        averageDelay,
        averageEtaVariance,
        averageTravelTime,
        averageRiskScore: avgRiskScore,
        weatherRisk,
        trafficRisk,
        festivalRisk,
        newsRisk,
        incidentDensity:          Math.min(100, incidentCount * 5),
        incidentCount,
        rerouteCount,
        historicalReliability,
        volatilityScore,
        operationalHealth,
        riskHistory:              [avgRiskScore, Math.max(0, avgRiskScore - 5), Math.max(0, avgRiskScore - 2)], // Simplified trend
        weatherTrend:             deriveWeatherTrend(weatherRisk),
        roadQuality:              Math.max(0, 100 - trafficRisk),
        currentOperationalStatus: deriveOperationalStatus(avgRiskScore),
        confidence:               Math.min(99, Math.round(50 + (row.shipmentCount as number) * 2)),
      };
    });

    // We do NOT use manualCorridors or FALLBACK_CORRIDORS anymore per requirements.
    
    return NextResponse.json({
      corridors:    liveCorridors,
      source:       "live",
      basedOnCount: aggregated.reduce((s, r) => s + (r.shipmentCount as number), 0),
      computedAt:   new Date().toISOString(),
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
