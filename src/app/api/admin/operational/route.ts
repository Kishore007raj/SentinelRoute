/**
 * GET /api/admin/operational
 *
 * Cross-tenant global operational monitor.
 * Returns active shipments with execution state where available.
 * Requires super_admin role.
 *
 * Query params:
 *   companyId   – filter to one tenant
 *   status      – "active" | "at-risk" (default: both)
 *   page        – page number (default 1)
 *   limit       – page size (default 50, max 100)
 *
 * Does NOT read from live_telemetry (doesn't exist).
 * Uses shipments + shipment_executions (both exist with indexes).
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

    const { searchParams } = new URL(req.url);
    const companyIdFilter = searchParams.get("companyId");
    const statusFilter    = searchParams.get("status"); // "active" | "at-risk" | null = both
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const skip  = (page - 1) * limit;

    // Build shipment query — always scoped to active/at-risk
    const shipmentQuery: Record<string, unknown> = {
      status: statusFilter
        ? statusFilter
        : { $in: ["active", "at-risk"] },
    };
    if (companyIdFilter) {
      shipmentQuery.companyId = companyIdFilter;
    }

    const [activeShipments, total] = await Promise.all([
      db.collection("shipments")
        .find(shipmentQuery)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .project({
          _id: 0, id: 1, shipmentCode: 1, companyId: 1, status: 1,
          origin: 1, destination: 1, originName: 1, destinationName: 1,
          riskScore: 1, riskLevel: 1, eta: 1, lastUpdate: 1,
          assignedDriverId: 1, assignedDriverName: 1,
          assignedVehicleId: 1, assignedVehicleNumber: 1,
          createdAt: 1, updatedAt: 1,
        })
        .toArray(),
      db.collection("shipments").countDocuments(shipmentQuery),
    ]);

    if (activeShipments.length === 0) {
      return NextResponse.json({ activeRoutes: [], total: 0, page, pages: 0 });
    }

    const shipmentIds = activeShipments.map((s) => s.id as string).filter(Boolean);
    const companyIds  = [...new Set(activeShipments.map((s) => s.companyId as string).filter(Boolean))];

    // Batch-fetch companies for tenant labels
    const companies = companyIds.length > 0
      ? await db.collection("companies")
          .find({ companyId: { $in: companyIds } })
          .project({ companyId: 1, companyName: 1, _id: 0 })
          .toArray()
      : [];
    const companyMap = new Map(
      companies.map((c) => [c.companyId as string, c.companyName as string])
    );

    // Batch-fetch execution state for these shipments
    const executions = shipmentIds.length > 0
      ? await db.collection("shipment_executions")
          .find({ shipmentId: { $in: shipmentIds } })
          .project({
            _id: 0, shipmentId: 1, status: 1, averageSpeed: 1,
            lastKnownLocation: 1, currentETA: 1, travelledDistance: 1,
            remainingDistance: 1, lastUpdated: 1,
          })
          .toArray()
      : [];
    const execMap = new Map(
      executions.map((e) => [e.shipmentId as string, e])
    );

    const aggregated = activeShipments.map((s) => {
      const execution = execMap.get(s.id as string) ?? null;
      const resolvedName = companyMap.get(s.companyId as string);
      return {
        ...s,
        // Show companyId as fallback if no company record found — avoids "Unknown Tenant"
        // while making the missing relationship visible to the admin
        tenantName: resolvedName ?? (s.companyId ? `[${String(s.companyId)}]` : "No Tenant"),
        tenantResolved: !!resolvedName,
        execution,
      };
    });

    return NextResponse.json({
      activeRoutes: aggregated,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
