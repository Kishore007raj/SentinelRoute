import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import { addTimelineEvent } from "@/lib/timeline-service";
import type { RouteLabel } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(req as any);
    const companyId = company.companyId;
    const isSuperAdmin = userRecord.role === "super_admin";
    const { id } = await params;

    const body = await req.json();
    const { action, routeLabel, routeName } = body;

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Allowed values: 'accept', 'reject'." },
        { status: 400 }
      );
    }

    const db = await getDb();
    
    // Find shipment
    const shipment = await db.collection("shipments").findOne({ id });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Tenant boundary & modification check
    if (shipment.companyId !== companyId) {
      if (isSuperAdmin) {
        return NextResponse.json(
          { error: "Super Admin has read-only visibility and no modification rights for other companies." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "accept") {
      const selectedRoute: RouteLabel = routeLabel || "safest";
      const newRouteName = routeName || "Alternative Safest Route";

      await db.collection("shipments").updateOne(
        { id },
        {
          $set: {
            selectedRoute,
            routeName: newRouteName,
            updatedAt: new Date().toISOString(),
            lastUpdate: new Date().toISOString(),
          }
        }
      );

      // Add timeline event
      await addTimelineEvent(
        id,
        companyId,
        "Route Changed",
        `Reroute accepted. Route changed to ${newRouteName} (${selectedRoute}).`,
        userRecord.name,
        100
      );

      // Audit routing event
      createIntelligenceAudit({
        companyId,
        shipmentId: id,
        userId:     userRecord.userId,
        eventType:  "reroute_accepted",
        source:     "RoutingAPI",
        metadata: {
          previousRoute: shipment.selectedRoute,
          newRoute:      selectedRoute,
          routeName:     newRouteName,
        },
      }).catch(() => {});

    } else {
      // Action === "reject"
      // Audit routing event
      createIntelligenceAudit({
        companyId,
        shipmentId: id,
        userId:     userRecord.userId,
        eventType:  "reroute_rejected",
        source:     "RoutingAPI",
        metadata: {
          currentRoute: shipment.selectedRoute,
          routeName:    shipment.routeName,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, action });
  } catch (err: any) {
    if (err instanceof Response) {
      return new NextResponse(err.body, { status: err.status, headers: { "Content-Type": "application/json" } });
    }
    console.error(`[POST /api/intelligence/shipments/[id]/reroute]`, err);
    return NextResponse.json({ error: "Failed to process rerouting" }, { status: 500 });
  }
}
