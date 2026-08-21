import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { createAuditEvent } from "@/lib/audit";
import { addTimelineEvent } from "@/lib/timeline-service";
import { utcNow } from "@/lib/time";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedCompany(req);
    const { id: incidentId } = await params;
    
    if (!incidentId) {
      return NextResponse.json({ error: "Missing incident ID" }, { status: 400 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { resolution, actionsTaken } = body;
    
    const db = await getDb();
    const now = utcNow();
    
    const incident = await db.collection("incidents").findOne({
      incidentId,
      companyId: auth.company.companyId
    });
    
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }
    
    await db.collection("incidents").updateOne(
      { incidentId, companyId: auth.company.companyId },
      { 
        $set: { 
          commandStatus: "resolved", 
          resolution: resolution || "Resolved by operator",
          actionsTaken: actionsTaken || [],
          lastUpdated: now,
          expectedEndTime: now
        } 
      }
    );
    
    if (incident.relatedShipmentId) {
      await addTimelineEvent(
        incident.relatedShipmentId, 
        auth.company.companyId, 
        "System Alert", 
        `Incident '${incident.title}' was resolved. ${resolution || ""}`, 
        "system", 
        100
      );
    }
    
    await createAuditEvent({
      db,
      companyId: auth.company.companyId,
      eventType: "incident_resolved",
      performedBy: auth.userId,
      details: { incidentId }
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
