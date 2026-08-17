/**
 * GET /api/analytics/drivers
 *
 * Driver status distribution for the authenticated company.
 * Requires ANALYTICS_READ_ROLES.
 * Driver.status = "active" | "inactive" | "suspended"
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAccess, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = apiLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    const { companyId } = await requireAnalyticsAccess(req);
    const db = await getDb();

    const pipeline = [
      { $match: { companyId } },
      {
        $facet: {
          // status = "active"|"inactive"|"suspended"
          statusDistribution: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          // operationalStatus = "Available"|"Assigned"|"Driving"|"Paused"|"Offline"|"Completed"
          operationalDistribution: [
            { $group: { _id: "$operationalStatus", count: { $sum: 1 } } }
          ],
          summary: [
            { $group: { _id: null, total: { $sum: 1 } } }
          ],
        },
      },
    ];

    const results = await db.collection("drivers").aggregate(pipeline).toArray();
    const data    = results[0];

    return NextResponse.json({
      summary: data.summary[0] ?? { total: 0 },
      statusDistribution: (data.statusDistribution as { _id: string; count: number }[]).reduce(
        (acc: Record<string, number>, curr) => { acc[curr._id ?? "unknown"] = curr.count; return acc; },
        {}
      ),
      operationalDistribution: (data.operationalDistribution as { _id: string | null; count: number }[]).reduce(
        (acc: Record<string, number>, curr) => { acc[curr._id ?? "Unset"] = curr.count; return acc; },
        {}
      ),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
