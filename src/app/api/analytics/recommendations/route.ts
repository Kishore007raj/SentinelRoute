/**
 * GET /api/analytics/recommendations
 *
 * Operational recommendation status/type distribution for the authenticated company.
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
          statusDistribution: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          typeDistribution: [
            { $group: { _id: "$type", count: { $sum: 1 } } }
          ],
          summary: [
            {
              $group: {
                _id:      null,
                total:    { $sum: 1 },
                accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
              },
            },
          ],
        },
      },
    ];

    const results = await db.collection("operational_recommendations").aggregate(pipeline).toArray();
    const data    = results[0];

    const summary = (data.summary[0] as { total: number; accepted: number } | undefined) ?? { total: 0, accepted: 0 };
    const acceptanceRate = summary.total > 0 ? (summary.accepted / summary.total) * 100 : 0;

    return NextResponse.json({
      summary: { ...summary, acceptanceRate },
      statusDistribution: (data.statusDistribution as { _id: string; count: number }[]).reduce(
        (acc: Record<string, number>, curr) => { acc[curr._id ?? "unknown"] = curr.count; return acc; },
        {}
      ),
      typeDistribution: (data.typeDistribution as { _id: string; count: number }[]).reduce(
        (acc: Record<string, number>, curr) => { acc[curr._id ?? "Unknown"] = curr.count; return acc; },
        {}
      ),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
