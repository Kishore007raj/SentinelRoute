import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(req as any);
    const companyId = company.companyId;
    const isSuperAdmin = userRecord.role === "super_admin";
    const { id } = await params;

    const body = await req.json();
    const { status } = body;

    if (status !== "acknowledged" && status !== "resolved") {
      return NextResponse.json(
        { error: "Invalid status. Allowed values: 'acknowledged', 'resolved'." },
        { status: 400 }
      );
    }

    const db = await getDb();
    
    // Find alert
    const alert = await db.collection("operational_alerts").findOne({ alertId: id });
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    // Tenant boundary & modification check
    if (alert.companyId !== companyId) {
      if (isSuperAdmin) {
        return NextResponse.json(
          { error: "Super Admin has read-only visibility and no modification rights for other companies." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.collection("operational_alerts").updateOne(
      { alertId: id },
      { $set: { status, updatedAt: new Date().toISOString() } }
    );

    // Audit event (fire-and-forget)
    createIntelligenceAudit({
      companyId:  alert.companyId,
      shipmentId: alert.shipmentId,
      userId:     userRecord.userId,
      eventType:  status === "acknowledged" ? "alert_acknowledged" : "alert_resolved",
      source:     "AlertsAPI",
      metadata: {
        alertId:    id,
        reason:     alert.reason,
        confidence: alert.confidence,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, alert: { ...alert, status } });
  } catch (err: any) {
    if (err instanceof Response) {
      return new NextResponse(err.body, { status: err.status, headers: { "Content-Type": "application/json" } });
    }
    console.error(`[PATCH /api/intelligence/alerts/[id]]`, err);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
