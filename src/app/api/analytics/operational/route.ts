/**
 * GET /api/analytics/operational
 *
 * Operational health score trend from the operational_metrics collection.
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
    // Scope to health_score type records for this company
    const matchStage: Record<string, unknown> = { companyId, type: "health_score" };
    if (dateFilter) matchStage.calculatedAt = dateFilter;

    const db = await getDb();

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id:      { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$calculatedAt" } } },
          avgScore: { $avg: "$value" },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const results = await db.collection("operational_metrics").aggregate(pipeline).toArray();

    return NextResponse.json({
      healthTrend: results.map((d) => ({ date: d._id as string, score: d.avgScore as number })),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
