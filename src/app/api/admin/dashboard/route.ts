/**
 * GET /api/admin/dashboard
 *
 * Platform-owner dashboard metrics. All counts derived from real MongoDB data.
 * Requires super_admin role.
 *
 * Fixed: incidents collection has no "status" field — count from incident_events
 * which has commandStatus. Count any non-resolved incidents.
 * Fixed: added adminLimiter rate limiting.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";
import { adminLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = adminLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    const [
      companiesTotal,
      companiesActive,
      companiesPending,
      companiesSuspended,
      companiesRejected,
      usersTotal,
      shipmentsTotal,
      shipmentsActive,
      // incident_events has commandStatus; count those not yet resolved
      incidentsOpen,
      driversActive,
      vehiclesActive,
    ] = await Promise.all([
      db.collection("companies").countDocuments({}),
      db.collection("companies").countDocuments({ status: "approved" }),
      db.collection("companies").countDocuments({ status: "pending" }),
      db.collection("companies").countDocuments({ status: "suspended" }),
      db.collection("companies").countDocuments({ status: "rejected" }),
      // Exclude the platform sentinel user from the count
      db.collection("users").countDocuments({ companyId: { $ne: "platform" } }),
      db.collection("shipments").countDocuments({}),
      db.collection("shipments").countDocuments({ status: { $in: ["active", "at-risk"] } }),
      // incident_events has commandStatus: "open"|"investigating"|"mitigating"|"resolved"
      db.collection("incident_events").countDocuments({
        commandStatus: { $in: ["open", "investigating", "mitigating"] },
      }),
      // Drivers in active operational status across all companies
      db.collection("drivers").countDocuments({
        operationalStatus: { $in: ["Assigned", "Driving", "Paused"] },
      }),
      // Vehicles currently assigned
      db.collection("vehicles").countDocuments({ status: "assigned" }),
    ]);

    const memoryUsage = process.memoryUsage();
    const memoryUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    return NextResponse.json({
      companies: {
        total:     companiesTotal,
        active:    companiesActive,
        pending:   companiesPending,
        suspended: companiesSuspended,
        rejected:  companiesRejected,
      },
      users: {
        total: usersTotal,
      },
      shipments: {
        total:  shipmentsTotal,
        active: shipmentsActive,
      },
      incidents: {
        // Renamed from "open" to "active" to be accurate — reflects non-resolved incident events
        active: incidentsOpen,
      },
      workforce: {
        activeDrivers:  driversActive,
        activeVehicles: vehiclesActive,
      },
      health: {
        status:        "healthy",
        uptime:        process.uptime(),
        memoryUsedMb,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
