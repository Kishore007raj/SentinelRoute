/**
 * GET /api/analytics/shipments
 *
 * Shipment volume, status distribution, and daily breakdown for the
 * authenticated user's company. Requires ANALYTICS_READ_ROLES.
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
          statusDistribution: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          dailyVolume: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          summary: [
            {
              $group: {
                _id:         null,
                total:       { $sum: 1 },
                // distanceKm is stored as a numeric field on Shipment
                avgDistance: { $avg: "$distanceKm" },
              },
            },
          ],
        },
      },
    ];

    const results = await db.collection("shipments").aggregate(pipeline).toArray();
    const data    = results[0];

    return NextResponse.json({
      summary: data.summary[0] ?? { total: 0, avgDistance: 0 },
      statusDistribution: (data.statusDistribution as { _id: string; count: number }[]).reduce(
        (acc: Record<string, number>, curr) => { acc[curr._id] = curr.count; return acc; },
        {}
      ),
      dailyVolume: (data.dailyVolume as { _id: string; count: number }[]).map(
        (d) => ({ date: d._id, volume: d.count })
      ),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
