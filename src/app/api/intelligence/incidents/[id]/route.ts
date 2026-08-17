import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(req);
    const companyId = company.companyId;
    const isSuperAdmin = userRecord.role === "super_admin";
    const { id } = await params;

    const body = await req.json();
    const { status, resolution } = body;

    if (status !== "closed") {
      return NextResponse.json(
        { error: "Invalid status. Only 'closed' is accepted via this endpoint." },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Incidents may live in either incident_events (news/external) or incidents (company-scoped)
    // Try incident_events first, then incidents collection
    let incident = await db.collection("incident_events").findOne({ incidentId: id });
    let collection = "incident_events";

    if (!incident) {
      incident = await db.collection("incidents").findOne({ incidentId: id });
      collection = "incidents";
    }

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    // Tenant boundary check - global incidents (companyId: null/undefined) can be closed by any authenticated company user
    // Company-scoped incidents can only be closed by the owning company
    const incidentCompanyId = incident.companyId as string | null | undefined;
    if (incidentCompanyId && incidentCompanyId !== companyId) {
      if (isSuperAdmin) {
        return NextResponse.json(
          { error: "Super Admin has read-only visibility and no modification rights for other companies." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const closedAt = new Date().toISOString();

    await db.collection(collection).updateOne(
      { incidentId: id },
      {
        $set: {
          status:      "closed",
          closedAt,
          closedBy:    userRecord.userId,
          resolution:  resolution || "Manually closed by operator",
          lastUpdated: closedAt,
        },
      }
    );

    // ── Audit: incident_closed ─────────────────────────────────────────────
    createIntelligenceAudit({
      companyId:  companyId,
      incidentId: id,
      userId:     userRecord.userId,
      eventType:  "incident_closed",
      source:     "IncidentsAPI",
      metadata: {
        incidentId:  id,
        title:       incident.title,
        category:    incident.category,
        severity:    incident.severity,
        resolution:  resolution || "Manually closed by operator",
        closedAt,
        collection,
      },
    }).catch(() => {});

    return NextResponse.json({
      success:   true,
      incidentId: id,
      status:    "closed",
      closedAt,
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
