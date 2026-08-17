/**
 * GET /api/analytics/trends
 *
 * Returns time-series trend data for a specific metric.
 * Requires ANALYTICS_READ_ROLES.
 *
 * Query params:
 *   ?metric=shipment_volume|incidents|risk_score|predictions  (required)
 *   ?granularity=daily|weekly|monthly                         (default: daily)
 *   ?start=ISO&end=ISO                                        (custom range)
 *   ?preset=DateRangePreset                                   (default: monthly)
 *
 * Response: { trend: [{ date, value, ... }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAccess, handleAuthError } from "@/lib/auth-helpers";
import { TrendEngine } from "@/lib/analytics/trend-engine";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";
import type { DateRangePreset } from "@/lib/analytics/analytics-utils";

const VALID_METRICS = ["shipment_volume", "incidents", "risk_score", "predictions"] as const;
type TrendMetric = typeof VALID_METRICS[number];
const VALID_GRANULARITIES = ["daily", "weekly", "monthly"] as const;
type Granularity = typeof VALID_GRANULARITIES[number];

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = apiLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    const { companyId } = await requireAnalyticsAccess(req);
    const searchParams = req.nextUrl.searchParams;

    const metricParam = searchParams.get("metric");
    if (!metricParam || !VALID_METRICS.includes(metricParam as TrendMetric)) {
      return ApiErrors.badRequest(
        `Invalid or missing metric. Must be one of: ${VALID_METRICS.join(", ")}`,
        "INVALID_METRIC",
        "metric"
      );
    }
    const metric = metricParam as TrendMetric;

    const granularityParam = searchParams.get("granularity") ?? "daily";
    if (!VALID_GRANULARITIES.includes(granularityParam as Granularity)) {
      return ApiErrors.badRequest(
        `Invalid granularity. Must be one of: ${VALID_GRANULARITIES.join(", ")}`,
        "INVALID_GRANULARITY",
        "granularity"
      );
    }
    const granularity = granularityParam as Granularity;

    const start   = searchParams.get("start")  ?? undefined;
    const end     = searchParams.get("end")    ?? undefined;
    const preset  = (searchParams.get("preset") as DateRangePreset) ?? "monthly";

    const trendData = await TrendEngine.getTrendData(
      companyId,
      metric,
      { start, end, preset },
      granularity
    );

    const response = NextResponse.json({ trend: trendData });
    response.headers.set("Cache-Control", "private, s-maxage=30, stale-while-revalidate=59");
    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
