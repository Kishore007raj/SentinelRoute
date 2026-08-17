/**
 * GET /api/admin/analytics
 *
 * Platform-level cross-tenant analytics.
 * Month-over-month growth comparing:
 *   - "this month"  = last 30 days (now-30d → now)
 *   - "last month"  = the 30-day period before that (now-60d → now-30d)
 *
 * MoM semantics:
 *   - previous = 0, current = 0  → null  (no data either period)
 *   - previous = 0, current > 0  → null  (new activity, no baseline; shown as "New")
 *   - previous > 0, current = 0  → -100%
 *   - otherwise                  → ((current - previous) / previous) * 100
 *
 * Daily shipment chart uses $toDate on the createdAt ISO string field,
 * which works for both ISO string and Date BSON types.
 *
 * Requires super_admin role.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";
import { adminLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";
import { startOfDay, subDays } from "date-fns";

/**
 * Compute month-over-month percentage change.
 *
 * Returns:
 *   null  — when previous = 0 (no meaningful baseline; UI shows "New" or "N/A")
 *   number — signed percentage otherwise
 *
 * This intentionally avoids returning -100% when comparing a real
 * current value against a zero previous value.
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    // No baseline — cannot compute a meaningful percentage
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = adminLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    const now = new Date();

    // "This month"  = the last 30 days
    const thisMonthStart = startOfDay(subDays(now, 30));  // now - 30 days
    // "Last month"  = the 30-day window immediately before that
    const lastMonthStart = startOfDay(subDays(now, 60));  // now - 60 days
    const lastMonthEnd   = thisMonthStart;                 // now - 30 days (exclusive upper bound)

    const thisMonthStartISO = thisMonthStart.toISOString();
    const lastMonthStartISO = lastMonthStart.toISOString();
    const lastMonthEndISO   = lastMonthEnd.toISOString();

    // Run all aggregations in parallel for performance
    const [
      totalCompanies,
      totalShipments,
      totalUsers,
      companiesThisMonth,
      companiesLastMonth,
      shipmentsThisMonth,
      shipmentsLastMonth,
      usersThisMonth,
      usersLastMonth,
      dailyShipmentsRaw,
    ] = await Promise.all([
      db.collection("companies").countDocuments({}),
      db.collection("shipments").countDocuments({}),
      // Exclude the platform sentinel user from company user counts
      db.collection("users").countDocuments({ companyId: { $ne: "platform" } }),

      // Companies registered in the last 30 days
      db.collection("companies").countDocuments({
        createdAt: { $gte: thisMonthStartISO },
      }),
      // Companies registered 30–60 days ago
      db.collection("companies").countDocuments({
        createdAt: { $gte: lastMonthStartISO, $lt: lastMonthEndISO },
      }),

      // Shipments created in the last 30 days
      db.collection("shipments").countDocuments({
        createdAt: { $gte: thisMonthStartISO },
      }),
      // Shipments created 30–60 days ago
      db.collection("shipments").countDocuments({
        createdAt: { $gte: lastMonthStartISO, $lt: lastMonthEndISO },
      }),

      // Users created in the last 30 days
      db.collection("users").countDocuments({
        companyId: { $ne: "platform" },
        createdAt: { $gte: thisMonthStartISO },
      }),
      // Users created 30–60 days ago
      db.collection("users").countDocuments({
        companyId: { $ne: "platform" },
        createdAt: { $gte: lastMonthStartISO, $lt: lastMonthEndISO },
      }),

      // Daily shipment buckets for the last 30 days
      // $toDate handles both ISO string and native BSON Date fields
      db.collection("shipments")
        .aggregate([
          { $match: { createdAt: { $gte: thisMonthStartISO } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $toDate: "$createdAt" },
                },
              },
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
        // null = no previous baseline (correct — not -100%)
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

      // Array of { date: "YYYY-MM-DD", value: N } for last 30 days
      dailyShipments,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
