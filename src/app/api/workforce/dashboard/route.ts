/**
 * GET /api/workforce/dashboard
 *
 * Returns live workforce statistics for the authenticated user's company.
 * Auth: requireWorkforceRead — roles: DASHBOARD_ROLES.
 * driver role → 403 (blocked before auth helper check in role matrix).
 * super_admin → accepts optional ?companyId= query param; without it returns
 * aggregate stats across all companies (no companyId filter applied).
 *
 * Index initialisation: ensureWorkforceIndexes runs once per process from
 * getDb() in mongodb.ts — not called here.
 *
 * Response 200:
 *   totalDrivers, activeDrivers, totalVehicles, availableVehicles,
 *   assignedVehicles, inactiveVehicles, recentActivity (10), upcomingExpirations
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  requireWorkforceRead,
  handleAuthError,
} from "@/lib/auth-helpers";
import type { WorkforceAudit, Driver, Vehicle } from "@/lib/types";

// ─── GET /api/workforce/dashboard ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── 1. Authenticate & authorise ───────────────────────────────────────────
  let userId: string;
  let userRecord: Awaited<ReturnType<typeof requireWorkforceRead>>["userRecord"];
  let companyId: string;

  try {
    const auth = await requireWorkforceRead(req);
    userId    = auth.userId;
    userRecord = auth.userRecord;
    companyId  = auth.companyId;
  } catch (err) {
    return handleAuthError(err);
  }

  // ── 2. Explicit driver block (requirement 8.4) ────────────────────────────
  //    requireWorkforceRead already excludes driver from WORKFORCE_READ_ROLES,
  //    so this guard is defence-in-depth / explicit requirement compliance.
  if (userRecord.role === "driver") {
    return NextResponse.json(
      { error: "Drivers do not have access to the workforce dashboard." },
      { status: 403 }
    );
  }

  // ── 3. Build companyId filter ─────────────────────────────────────────────
  //    super_admin with no ?companyId= → aggregate across all companies
  //    (omit companyId from every query).
  //    super_admin with ?companyId= → scoped to that company.
  //    all other roles → always scoped to their own company.
  const isSuperAdmin = userRecord.role === "super_admin";

  // For super_admin with a companyId param, companyId is already set by
  // requireWorkforceRead (reads from ?companyId= query param).
  // For super_admin without the param, companyId === "" (empty string from helper).
  const useGlobalScope = isSuperAdmin && !companyId;

  // Builds the base filter object — either scoped or empty (global).
  const baseFilter = useGlobalScope ? {} : { companyId };

  // ── 4. Compute thirtyDaysFromNow (ISO date string, calendar days) ─────────
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysFromNowISO = thirtyDaysFromNow.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // ── 5. Run all 9 live MongoDB aggregation queries in parallel ─────────────
  try {
    const db = await getDb();

    const drivers  = db.collection("drivers");
    const vehicles = db.collection("vehicles");
    const audits   = db.collection("workforce_audits");

    const [
      totalDrivers,
      activeDrivers,
      totalVehicles,
      availableVehicles,
      assignedVehicles,
      inactiveVehicles,
      recentActivityDocs,
      expiringDriversDocs,
      expiringVehiclesDocs,
    ] = await Promise.all([
      // 1. Total drivers
      drivers.countDocuments(baseFilter),

      // 2. Active drivers
      drivers.countDocuments({ ...baseFilter, status: "active" }),

      // 3. Total vehicles
      vehicles.countDocuments(baseFilter),

      // 4. Available vehicles
      vehicles.countDocuments({ ...baseFilter, status: "available" }),

      // 5. Assigned vehicles
      vehicles.countDocuments({ ...baseFilter, status: "assigned" }),

      // 6. Inactive vehicles (status "inactive" OR "maintenance")
      vehicles.countDocuments({
        ...baseFilter,
        status: { $in: ["inactive", "maintenance"] },
      }),

      // 7. Recent activity — 10 most recent, sorted by timestamp desc
      audits
        .find(baseFilter)
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray(),

      // 8. Drivers with license expiring within 30 days
      drivers
        .find({
          ...baseFilter,
          licenseExpiry: { $lte: thirtyDaysFromNowISO },
        })
        .toArray(),

      // 9. Vehicles with any document expiring within 30 days
      vehicles
        .find({
          ...baseFilter,
          $or: [
            { insuranceExpiry: { $lte: thirtyDaysFromNowISO } },
            { permitExpiry:    { $lte: thirtyDaysFromNowISO } },
            { fitnessExpiry:   { $lte: thirtyDaysFromNowISO } },
          ],
        })
        .toArray(),
    ]);

    // ── 6. Shape the response ─────────────────────────────────────────────────

    // Strip MongoDB _id from audit records and cast to WorkforceAudit[]
    const recentActivity: WorkforceAudit[] = recentActivityDocs.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ _id, ...rest }) => rest as WorkforceAudit
    );

    // Driver expiry projection: only driverId, fullName, licenseExpiry
    const expiringDrivers = expiringDriversDocs.map((doc) => {
      const d = doc as unknown as Driver;
      return {
        driverId:     d.driverId,
        fullName:     d.fullName,
        licenseExpiry: d.licenseExpiry,
      };
    });

    // Vehicle expiry projection: vehicleId, vehicleNumber, and the three expiry dates
    const expiringVehicles = expiringVehiclesDocs.map((doc) => {
      const v = doc as unknown as Vehicle;
      const entry: {
        vehicleId:        string;
        vehicleNumber:    string;
        insuranceExpiry?: string;
        permitExpiry?:    string;
        fitnessExpiry?:   string;
      } = {
        vehicleId:     v.vehicleId,
        vehicleNumber: v.vehicleNumber,
      };
      if (v.insuranceExpiry) entry.insuranceExpiry = v.insuranceExpiry;
      if (v.permitExpiry)    entry.permitExpiry    = v.permitExpiry;
      if (v.fitnessExpiry)   entry.fitnessExpiry   = v.fitnessExpiry;
      return entry;
    });

    // Log super_admin cross-company read for audit trail (fire-and-forget)
    if (isSuperAdmin) {
      db.collection("workforce_audits")
        .insertOne({
          auditId:    `waudit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          companyId:  companyId || "ALL",
          eventType:  "super_admin_read",
          actorId:    userId,
          targetId:   companyId || "ALL",
          targetType: "user",
          details:    { endpoint: "dashboard", scopedCompanyId: companyId || null },
          timestamp:  new Date().toISOString(),
        })
        .catch((err) =>
          console.error("[GET /api/workforce/dashboard] Audit write failed:", err)
        );
    }

    return NextResponse.json({
      totalDrivers,
      activeDrivers,
      totalVehicles,
      availableVehicles,
      assignedVehicles,
      inactiveVehicles,
      recentActivity,
      upcomingExpirations: {
        drivers:  expiringDrivers,
        vehicles: expiringVehicles,
      },
    });
  } catch (err) {
    console.error("[GET /api/workforce/dashboard] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
