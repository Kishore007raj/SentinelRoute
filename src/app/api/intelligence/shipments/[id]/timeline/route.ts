import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getShipmentTimeline } from "@/lib/timeline-service";
import { getDb } from "@/lib/mongodb";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(req);
    const isSuperAdmin = userRecord.role === "super_admin";

    let companyId = company.companyId;
    const url = new URL(req.url);
    const targetCompanyId = url.searchParams.get("companyId");
    if (isSuperAdmin && targetCompanyId) {
      companyId = targetCompanyId;
    }

    const { id } = await params;

    const db = await getDb();
    
    // Verify shipment access
    const shipment = await db.collection("shipments").findOne({ id, companyId });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // super_admin audit (fire-and-forget)
    if (isSuperAdmin && targetCompanyId) {
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "ShipmentTimelineRoute",
        metadata: {
          companyIdViewed: companyId,
          shipmentId:      id,
          endpoint:        `/api/intelligence/shipments/${id}/timeline`,
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    }

    const timeline = await getShipmentTimeline(id);

    return NextResponse.json({ timeline });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
