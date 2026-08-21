import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";

/**
 * GET /api/analytics/forecast
 * Produces deterministic next-30-day projections using a 3-month trailing average.
 * No ML or external services – pure arithmetic on existing MongoDB data.
 */
export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const db = await getDb();

    const now = Date.now();
    const since90d = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get trailing 90 days of completed executions
    const executions90d = await db.collection("shipment_executions").find({
      companyId: company.companyId,
      status: "completed",
      tripEndTime: { $gte: since90d },
    }, { projection: { tripEndTime: 1 } }).toArray();

    const executions30d = executions90d.filter(ex => ex.tripEndTime >= since30d);

    // Get trailing 90 days of incidents
    const incidents90d = await db.collection("incidents").find({
      companyId: company.companyId,
      startTime: { $gte: since90d },
    }, { projection: { startTime: 1, severity: 1 } }).toArray();

    const incidents30d = incidents90d.filter(inc => inc.startTime >= since30d);

    // Daily rates
    const dailyShipments90 = executions90d.length / 90;
    const dailyShipments30 = executions30d.length / 30;
    const dailyIncidents90 = incidents90d.length / 90;
    const dailyIncidents30 = incidents30d.length / 30;

    // Weighted forecast: 60% recent 30d + 40% trailing 90d
    const forecastedDailyShipments = dailyShipments30 * 0.6 + dailyShipments90 * 0.4;
    const forecastedDailyIncidents = dailyIncidents30 * 0.6 + dailyIncidents90 * 0.4;

    // Calculate trend direction
    const shipmentTrend = dailyShipments30 > dailyShipments90 ? "increasing" : dailyShipments30 < dailyShipments90 ? "decreasing" : "stable";
    const incidentTrend = dailyIncidents30 > dailyIncidents90 ? "increasing" : dailyIncidents30 < dailyIncidents90 ? "decreasing" : "stable";

    // Build projected 30-day series
    const projectedDays = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now + (i + 1) * 24 * 60 * 60 * 1000);
      // Add minor variance (±5%) using day index as seed
      const variance = 1 + (Math.sin(i * 2.1) * 0.05);
      return {
        date: d.toISOString().split("T")[0],
        projectedShipments: Math.max(0, Math.round(forecastedDailyShipments * variance * 10) / 10),
        projectedIncidents: Math.max(0, Math.round(forecastedDailyIncidents * variance * 100) / 100),
      };
    });

    return NextResponse.json({
      forecast: projectedDays,
      metadata: {
        forecastedMonthlyShipments: Math.round(forecastedDailyShipments * 30),
        forecastedMonthlyIncidents: Math.round(forecastedDailyIncidents * 30),
        shipmentTrend,
        incidentTrend,
        basedOnDays: 90,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
