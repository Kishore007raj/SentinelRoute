import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { emitToCompany } from "@/lib/socket-server";
import { addTimelineEvent } from "@/lib/timeline-service";
import type { Route, Shipment, ShipmentExecution } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(request);
    const { id } = await params;
    const body = await request.json();
    const { newRoute, reason } = body as { newRoute?: Route, reason?: string };

    const db = await getDb();
    
    // Validate shipment
    const shipmentDoc = await db.collection("shipments").findOne({ id, companyId: company.companyId });
    if (!shipmentDoc) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }
    const shipment = shipmentDoc as unknown as Shipment;

    // Validate execution
    const executionDoc = await db.collection("shipment_executions").findOne({ shipmentId: id, companyId: company.companyId });
    if (!executionDoc) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    const defaultRoute: Route = {
      id: `route-${Date.now()}`,
      label: "safest",
      name: "Safe Alternate Route",
      eta: shipment.eta || "N/A",
      etaMinutes: 120,
      distance: shipment.distance || "N/A",
      distanceKm: 0,
      riskScore: 20,
      riskLevel: "low",
      recommended: true,
      summary: "System-generated alternate route to bypass current risks.",
      riskBreakdown: { traffic: 20, weather: 10, disruption: 5, cargoSensitivity: shipment.riskBreakdown?.cargoSensitivity || 50 },
      alerts: []
    };

    const finalRoute = newRoute || defaultRoute;

    // Update execution planned route
    await db.collection("shipment_executions").updateOne(
      { shipmentId: id, companyId: company.companyId },
      { $set: { plannedRoute: finalRoute, updatedAt: new Date().toISOString() } }
    );

    // Also update shipment selected route label for consistency
    await db.collection("shipments").updateOne(
      { id, companyId: company.companyId },
      { $set: { 
        selectedRoute: finalRoute.label,
        routeName: finalRoute.name,
        riskLevel: finalRoute.riskLevel,
        riskScore: finalRoute.riskScore,
        updatedAt: new Date().toISOString() 
      } }
    );

    // Emit socket event to driver and dispatchers
    emitToCompany(company.companyId, "route:updated", {
      shipmentId: id,
      plannedRoute: finalRoute
    });

    // Add timeline audit
    await addTimelineEvent(
      id,
      company.companyId,
      "Route Changed",
      `Dynamic reroute triggered. New route: ${finalRoute.name}. ${reason ? "Reason: " + reason : ""}`,
      userRecord.role === "super_admin" || userRecord.role === "dispatcher" ? "Dispatcher" : "System",
      100,
      ["distance", "eta"]
    );

    return NextResponse.json({ success: true, plannedRoute: finalRoute });
  } catch (error) {
    return handleAuthError(error);
  }
}
