/**
 * GET /api/analytics/risk
 *
 * Risk factor trend from risk_calculations collection.
 * Requires ANALYTICS_READ_ROLES.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAccess, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { buildDateFilter, type DateRangePreset } from "@/lib/analytics/analytics-utils";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = apiLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    const { companyId } = await requireAnalyticsAccess(req);
    const searchParams  = req.nextUrl.searchParams;

    const start  = searchParams.get("start")  ?? undefined;
    const end    = searchParams.get("end")    ?? undefined;
    const preset = (searchParams.get("preset") as DateRangePreset) ?? undefined;

    const dateFilter = buildDateFilter({ start, end, preset });
    const matchStage: Record<string, unknown> = { companyId };
    if (dateFilter) matchStage.createdAt = dateFilter;

    const db = await getDb();

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          riskTrend: [
            {
              $group: {
                _id:            { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
                avgOverallRisk: { $avg: "$riskFactors.overall" },
                avgWeatherRisk: { $avg: "$riskFactors.weather" },
                avgTrafficRisk: { $avg: "$riskFactors.traffic" },
                avgSecurityRisk:{ $avg: "$riskFactors.security" },
              },
            },
            { $sort: { _id: 1 } },
          ],
          summary: [
            {
              $group: {
                _id:               null,
                totalCalculations: { $sum: 1 },
                avgOverallRisk:    { $avg: "$riskFactors.overall" },
              },
            },
          ],
        },
      },
    ];

    const results = await db.collection("risk_calculations").aggregate(pipeline).toArray();
    const data    = results[0];

    type RiskTrendRaw = {
      _id:             string;
      avgOverallRisk:  number;
      avgWeatherRisk:  number;
      avgTrafficRisk:  number;
      avgSecurityRisk: number;
    };

    return NextResponse.json({
      summary: data.summary[0] ?? { totalCalculations: 0, avgOverallRisk: 0 },
      riskTrend: (data.riskTrend as RiskTrendRaw[]).map((d) => ({
        date:     d._id,
        overall:  d.avgOverallRisk,
        weather:  d.avgWeatherRisk,
        traffic:  d.avgTrafficRisk,
        security: d.avgSecurityRisk,
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
