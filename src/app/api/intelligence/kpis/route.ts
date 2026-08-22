/**
 * GET /api/intelligence/kpis
 *
 * Returns live operational KPIs calculated from MongoDB collections.
 * No hardcoded values. All metrics are derived from real data.
 *
 * Metrics:
 *   highRiskShipments        - count of shipments with status "at-risk" or riskLevel "critical"/"high"
 *   activeAlerts             - count of operational_alerts for this company
 *   openIncidents            - count of active incidents in incident_events
 *   avgOperationalRisk        - average overallOperationalConfidence (inverted) from recent route_predictions
 *   avgDelayProbability      - average delayProbability from recent route_predictions
 *   avgDisruptionProbability - average disruptionProbability from recent route_predictions
 *   avgEtaConfidence         - average etaConfidence from recent route_predictions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

export async function GET(req: NextRequest) {
  try {
    // Get auth token first
    const { userId } = await requireAuth(req);
    
    // Fetch user record from DB
    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ userId });
    
    if (!userRecord) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    const isSuperAdmin = userRecord.role === "super_admin";
    let companyId: string;

    // Super admins: get target company from query param
    if (isSuperAdmin) {
      const url = new URL(req.url);
      const targetCompanyId = url.searchParams.get("companyId");
      
      if (!targetCompanyId) {
        return NextResponse.json({ error: "Super admin must specify companyId query parameter" }, { status: 400 });
      }

      companyId = targetCompanyId;

      // Audit super admin read
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "KPIsRoute",
        metadata: {
          companyIdViewed: companyId,
          endpoint:        "/api/intelligence/kpis",
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    } else {
      // Regular users: require company and use their own company ID
      const companyResult = await requireCompany(req);
      companyId = companyResult.company.companyId;
    }

    // Run all aggregations in parallel for performance
    const [
      highRiskShipments,
      activeAlerts,
      openIncidents,
      recentPredictions,
    ] = await Promise.all([
      // 1. High-risk shipments: status at-risk OR riskLevel critical/high
      db.collection("shipments").countDocuments({
        companyId,
        $or: [
          { status: "at-risk" },
          { riskLevel: { $in: ["critical", "high"] } },
        ],
      }),

      // 2. Active alerts for this company
      db.collection("operational_alerts").countDocuments({ companyId }),

      // 3. Open incidents from incident_events (global + company-scoped)
      db.collection("incident_events").countDocuments({
        $or: [
          { companyId: null },
          { companyId: { $exists: false } },
          { companyId },
        ],
      }),

      // 4. Recent route_predictions for this company (last 50)
      db.collection("route_predictions")
        .find({ companyId })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray(),
    ]);

    // Compute averages from recent predictions
    let avgOperationalRisk      = 0;
    let avgDelayProbability     = 0;
    let avgDisruptionProbability = 0;
    let avgEtaConfidence        = 0;

    if (recentPredictions.length > 0) {
      const n = recentPredictions.length;
      avgOperationalRisk = Math.round(
        recentPredictions.reduce((s, p) => s + (100 - (p.overallOperationalConfidence ?? 50)), 0) / n
      );
      avgDelayProbability = Math.round(
        recentPredictions.reduce((s, p) => s + (p.delayProbability ?? 0), 0) / n
      );
      avgDisruptionProbability = Math.round(
        recentPredictions.reduce((s, p) => s + (p.disruptionProbability ?? 0), 0) / n
      );
      avgEtaConfidence = Math.round(
        recentPredictions.reduce((s, p) => s + (p.etaConfidence ?? 100), 0) / n
      );
    }

    return NextResponse.json({
      highRiskShipments,
      activeAlerts,
      openIncidents,
      avgOperationalRisk,
      avgDelayProbability,
      avgDisruptionProbability,
      avgEtaConfidence,
      basedOnPredictions: recentPredictions.length,
      computedAt:         new Date().toISOString(),
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
