/**
 * GET /api/analytics/predictions
 *
 * Route prediction confidence trend from route_predictions collection.
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
    // route_predictions uses both timestamp and createdAt — prefer createdAt
    if (dateFilter) matchStage.createdAt = dateFilter;

    const db = await getDb();

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          confidenceTrend: [
            {
              $group: {
                _id:           { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
                // etaConfidence is the right field from RoutePrediction
                avgConfidence: { $avg: "$etaConfidence" },
                count:         { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          summary: [
            {
              $group: {
                _id:           null,
                total:         { $sum: 1 },
                avgConfidence: { $avg: "$etaConfidence" },
              },
            },
          ],
        },
      },
    ];

    const results = await db.collection("route_predictions").aggregate(pipeline).toArray();
    const data    = results[0];

    type ConfRaw = { _id: string; avgConfidence: number; count: number };

    return NextResponse.json({
      summary: data.summary[0] ?? { total: 0, avgConfidence: 0 },
      confidenceTrend: (data.confidenceTrend as ConfRaw[]).map((d) => ({
        date:       d._id,
        confidence: d.avgConfidence,
        volume:     d.count,
      })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
