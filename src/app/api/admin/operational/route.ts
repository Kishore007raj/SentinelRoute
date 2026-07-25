import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    // Limit to 100 active shipments for global view performance
    const activeShipments = await db.collection("shipments")
      .find({ status: { $in: ["active", "at-risk"] } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();

    const shipmentIds = activeShipments.map(s => s.shipmentId);
    const companyIds = [...new Set(activeShipments.map(s => s.companyId))];

    // Fetch related companies for tenant labeling
    const companies = await db.collection("companies")
      .find({ companyId: { $in: companyIds } })
      .toArray();
    const companyMap = new Map(companies.map(c => [c.companyId, c.companyName]));

    // Fetch latest telemetry for these shipments
    const telemetry = await db.collection("live_telemetry")
      .aggregate([
        { $match: { shipmentId: { $in: shipmentIds } } },
        { $sort: { timestamp: -1 } },
        { $group: { _id: "$shipmentId", latest: { $first: "$$ROOT" } } }
      ])
      .toArray();

    const telemetryMap = new Map(telemetry.map(t => [t._id, t.latest]));

    const aggregated = activeShipments.map(s => {
      const { _id: _omit, ...shipment } = s as Record<string, unknown>;
      const currentTelemetry = telemetryMap.get(s.shipmentId as string) ?? null;
      if (currentTelemetry) delete (currentTelemetry as Record<string, unknown>)._id;

      return {
        ...shipment,
        tenantName: companyMap.get(s.companyId) || "Unknown Tenant",
        telemetry: currentTelemetry
      };
    });

    return NextResponse.json({ activeRoutes: aggregated });
  } catch (err) {
    return handleAuthError(err);
  }
}
