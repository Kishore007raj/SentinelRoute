/**
 * GET /api/analytics/kpis
 *
 * Returns aggregated executive KPIs for the authenticated user's company.
 * Requires company_admin or operations_manager role (ANALYTICS_READ_ROLES).
 * Never trusts companyId from the client — always resolved from auth.
 *
 * Query params:
 *   ?start=ISO&end=ISO   custom date range
 *   ?preset=monthly      DateRangePreset
 *
 * Response: { shipments, fleet, drivers, incidents, healthScore }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  requireAnalyticsAccess,
  handleAuthError,
} from "@/lib/auth-helpers";
import { KPIEngine } from "@/lib/analytics/kpi-engine";
import { createAuditEvent } from "@/lib/audit";
import { getDb } from "@/lib/mongodb";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";
import type { DateRange } from "@/lib/analytics/analytics-utils";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = apiLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    const { userId, companyId } = await requireAnalyticsAccess(req);

    const searchParams = req.nextUrl.searchParams;
    const start = searchParams.get("start") ?? undefined;
    const end   = searchParams.get("end")   ?? undefined;
    const preset = (searchParams.get("preset") as DateRange["preset"]) ?? "monthly";

    const dateRange: DateRange = { start, end, preset };

    const kpis = await KPIEngine.getAllKPIs(companyId, dateRange);

    // Audit dashboard access (fire-and-forget)
    getDb().then((db) =>
      createAuditEvent({
        db,
        companyId,
        eventType:   "dashboard_accessed",
        performedBy: userId,
        details: { endpoint: "/api/analytics/kpis", dateRange },
      }).catch(() => {})
    ).catch(() => {});

    const response = NextResponse.json(kpis);
    // Cache for 30 seconds — analytics data tolerates brief staleness
    response.headers.set("Cache-Control", "private, s-maxage=30, stale-while-revalidate=59");
    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
