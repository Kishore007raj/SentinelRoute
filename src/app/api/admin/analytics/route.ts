/**
 * GET /api/admin/analytics
 *
 * Platform-level cross-tenant analytics.
 * Computes growth metrics by comparing this month vs last month
 * using real MongoDB aggregation — no hardcoded values.
 *
 * Requires super_admin role.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";
import { adminLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";
import { startOfDay, subDays, subMonths } from "date-fns";

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = adminLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    const now         = new Date();
    const thisMonthStart  = startOfDay(subDays(now, 30)).toISOString();
    const lastMonthStart  = startOfDay(subMonths(now, 2)).toISOString();
    const lastMonthEnd    = startOfDay(subDays(now, 30)).toISOString();
    const thirtyDaysAgo   = startOfDay(subDays(now, 30)).toISOString();

    // ── Run all aggregations in parallel ─────────────────────────────────────
    const [
      totalCompanies,
      totalShipments,
      totalUsers,
      // Companies created this month vs last month
      companiesThisMonth,
      companiesLastMonth,
      // Shipments created this month vs last month
      shipmentsThisMonth,
      shipmentsLastMonth,
      // Users created this month vs last month
      usersThisMonth,
      usersLastMonth,
      // Daily shipment volume for the last 30 days
      dailyShipmentsRaw,
    ] = await Promise.all([
      db.collection("companies").countDocuments({}),
      db.collection("shipments").countDocuments({}),
      db.collection("users").countDocuments({ companyId: { $ne: "platform" } }),

      db.collection("companies").countDocuments({ createdAt: { $gte: thisMonthStart } }),
      db.collection("companies").countDocuments({
        createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
      }),

      db.collection("shipments").countDocuments({ createdAt: { $gte: thisMonthStart } }),
      db.collection("shipments").countDocuments({
        createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
      }),

      db.collection("users").countDocuments({
        companyId: { $ne: "platform" },
        createdAt: { $gte: thisMonthStart },
      }),
      db.collection("users").countDocuments({
        companyId: { $ne: "platform" },
        createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
      }),

      // Daily shipment bucketing — last 30 days
      db.collection("shipments")
        .aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id:   { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
    ]);

    const dailyShipments = (dailyShipmentsRaw as { _id: string; count: number }[]).map(
      (d) => ({ date: d._id, value: d.count })
    );

    return NextResponse.json({
      totalCompanies,
      totalShipments,
      totalUsers,
      companyGrowth: {
        thisMonth:     companiesThisMonth,
        lastMonth:     companiesLastMonth,
        delta:         companiesThisMonth - companiesLastMonth,
        percentChange: percentChange(companiesThisMonth, companiesLastMonth),
      },
      shipmentVolume: {
        thisMonth:     shipmentsThisMonth,
        lastMonth:     shipmentsLastMonth,
        delta:         shipmentsThisMonth - shipmentsLastMonth,
        percentChange: percentChange(shipmentsThisMonth, shipmentsLastMonth),
      },
      userGrowth: {
        thisMonth:     usersThisMonth,
        lastMonth:     usersLastMonth,
        delta:         usersThisMonth - usersLastMonth,
        percentChange: percentChange(usersThisMonth, usersLastMonth),
      },
      dailyShipments,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
