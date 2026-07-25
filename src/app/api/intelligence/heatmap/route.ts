import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

interface RiskDoc {
  weatherRisk?: number;
  trafficRisk?: number;
  festivalRiskScore?: number;
  newsDisruptionBonus?: number;
  newsDelayBonus?: number;
}

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
        source:    "HeatmapRoute",
        metadata: {
          companyIdViewed: companyId,
          endpoint:        "/api/intelligence/heatmap",
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    }

    const db = await getDb();

    // Group shipments by their origin coordinates
    const aggregated = await db.collection("shipments").aggregate([
      {
        $match: {
          companyId,
          originLat: { $exists: true, $ne: null },
          originLng: { $exists: true, $ne: null },
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
            lat: { $round: ["$originLat", 3] }, // Group by roughly ~100m proximity
            lng: { $round: ["$originLng", 3] },
          },
          exactLat: { $first: "$originLat" },
          exactLng: { $first: "$originLng" },
          corridor: { $first: { $concat: ["$origin", " - ", "$destination"] } },
          shipmentCount: { $sum: 1 },
          avgRiskScore: { $avg: "$riskScore" },
          risksList: { $push: { $arrayElemAt: ["$risks", -1] } },
          allTimelineEvents: { $push: "$timeline" }
        },
      },
    ]).toArray();

    const heatPoints = aggregated.map((row, idx) => {
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

      let incidentCount = 0;
      (row.allTimelineEvents || []).forEach((events: Array<{ type: string }>) => {
        events.forEach(e => {
          if (e.type === "Incident Detected") incidentCount++;
        });
      });

      const incidentSeverity = Math.min(100, incidentCount * 20);
      
      // Calculate total intensity
      const totalIntensityScore = avgRiskScore + weatherRisk + trafficRisk + festivalRisk + newsRisk + incidentSeverity;
      const normalizedIntensity = Math.min(100, Math.round((totalIntensityScore / 600) * 100));
      
      // Determine dominant risk factor
      const factors = [
        { name: "Weather", val: weatherRisk },
        { name: "Traffic", val: trafficRisk },
        { name: "Festival", val: festivalRisk },
        { name: "News", val: newsRisk },
        { name: "Incidents", val: incidentSeverity },
      ];
      factors.sort((a, b) => b.val - a.val);
      const dominantRisk = factors[0].val > 20 ? factors[0].name : "Normal Operations";

      const averageDelay = Math.round(avgRiskScore * 0.5); // Derived estimation

      return {
        id: `heat-${idx}`,
        lat: row.exactLat,
        lng: row.exactLng,
        corridor: row.corridor,
        shipmentCount: row.shipmentCount,
        intensity: normalizedIntensity,
        dominantRisk,
        averageDelay,
        breakdown: {
          weather: weatherRisk,
          traffic: trafficRisk,
          festival: festivalRisk,
          news: newsRisk,
          incidents: incidentCount
        }
      };
    });

    return NextResponse.json({
      heatPoints,
      source: "live",
      computedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    if (err instanceof Response) {
      return new NextResponse(err.body, {
        status:  err.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[GET /api/intelligence/heatmap]", err);
    return NextResponse.json({ error: "Failed to fetch heatmap data" }, { status: 500 });
  }
}
