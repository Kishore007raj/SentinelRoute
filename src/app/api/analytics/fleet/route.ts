/**
 * GET /api/analytics/fleet
 *
 * Fleet status & type distribution for the authenticated company.
 * Requires ANALYTICS_READ_ROLES.
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

    const matchStage = { companyId };

    // Vehicle.status = "available"|"assigned"|"maintenance"|"inactive"
    // Vehicle.vehicleType is the type field (e.g. "Container Truck")
    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          statusDistribution: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          // Use vehicleType (not the non-existent "type" field)
          typeDistribution: [
            { $group: { _id: "$vehicleType", count: { $sum: 1 } } }
          ],
          summary: [
            { $group: { _id: null, total: { $sum: 1 } } }
          ],
        },
      },
    ];

    const results = await db.collection("vehicles").aggregate(pipeline).toArray();
    const data    = results[0];

    return NextResponse.json({
      summary: data.summary[0] ?? { total: 0 },
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
