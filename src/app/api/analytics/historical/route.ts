import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";

/**
 * GET /api/analytics/historical
 * Returns daily KPI trends for the past N days (default: 30).
 * Computes from shipment_executions and incidents collections.
 */
export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 90);

    const db = await getDb();
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Aggregate daily completed shipments and on-time rate from executions
    const executions = await db.collection("shipment_executions").find({
      companyId: company.companyId,
      status: "completed",
      tripEndTime: { $gte: sinceDate },
    }, { projection: { tripStartTime: 1, tripEndTime: 1, shipmentId: 1 } }).toArray();

    // Aggregate daily incidents
    const incidents = await db.collection("incidents").find({
      companyId: company.companyId,
      startTime: { $gte: sinceDate },
    }, { projection: { startTime: 1, severity: 1 } }).toArray();

    // Build daily buckets
    const dailyMap: Record<string, { date: string; completedShipments: number; incidents: number; criticalIncidents: number }> = {};
    
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { date: key, completedShipments: 0, incidents: 0, criticalIncidents: 0 };
    }

    executions.forEach((ex) => {
      const key = ex.tripEndTime?.split("T")[0];
      if (key && dailyMap[key]) {
        dailyMap[key].completedShipments++;
      }
    });

    incidents.forEach((inc) => {
      const key = inc.startTime?.split("T")[0];
      if (key && dailyMap[key]) {
        dailyMap[key].incidents++;
        if (inc.severity === "critical") {
          dailyMap[key].criticalIncidents++;
        }
      }
    });

    const trends = Object.values(dailyMap);

    // Calculate rolling averages
    const totalCompleted = trends.reduce((s, d) => s + d.completedShipments, 0);
    const totalIncidents = trends.reduce((s, d) => s + d.incidents, 0);

    return NextResponse.json({
      trends,
      summary: {
        totalCompleted,
        totalIncidents,
        avgCompletedPerDay: (totalCompleted / days).toFixed(1),
        avgIncidentsPerDay: (totalIncidents / days).toFixed(2),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
