/**
 * GET /api/analytics/company
 *
 * Company-level user role distribution.
 * Requires ANALYTICS_READ_ROLES (super_admin for cross-company context).
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
    const { companyId, company } = await requireAnalyticsAccess(req);
    const db = await getDb();

    const usersPipeline = [
      { $match: { companyId } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ];

    const userResults = await db.collection("users").aggregate(usersPipeline).toArray();

    const roleDistribution = (userResults as { _id: string; count: number }[]).reduce(
      (acc: Record<string, number>, curr) => { acc[curr._id ?? "unknown"] = curr.count; return acc; },
      {}
    );

    const totalUsers = userResults.reduce((sum, curr) => sum + (curr.count as number), 0);

    return NextResponse.json({
      company: {
        id:        company.companyId ?? companyId,
        name:      company.companyName ?? "—",
        status:    company.status     ?? "—",
        createdAt: company.createdAt  ?? "—",
      },
      roleDistribution,
      totalUsers,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
