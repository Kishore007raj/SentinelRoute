import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getActiveIncidents, storeIncident } from "@/lib/intelligence-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import type { Incident, IncidentCategory } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const { userRecord, company } = await requireCompany(req as any);
    const isSuperAdmin = userRecord.role === "super_admin";

    let companyId = company.companyId;
    const url = new URL(req.url);
    const targetCompanyId = url.searchParams.get("companyId");
    if (isSuperAdmin && targetCompanyId) {
      companyId = targetCompanyId;
    }

    if (isSuperAdmin && targetCompanyId) {
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "IncidentsRoute",
        metadata:  { companyIdViewed: companyId, endpoint: "/api/intelligence/incidents", timestamp: new Date().toISOString() },
      }).catch(() => {});
    }

    const incidents = await getActiveIncidents(companyId);
    return NextResponse.json({ incidents });
  } catch (err: any) {
    if (err instanceof Response) return new NextResponse(err.body, { status: err.status, headers: { "Content-Type": "application/json" } });
    console.error("[GET /api/intelligence/incidents]", err);
    return NextResponse.json({ error: "Failed to fetch incidents" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userRecord, company } = await requireCompany(req as any);

    // Super admin is read-only for incident mutation
    if (userRecord.role === "super_admin") {
      return NextResponse.json({ error: "Super Admin may not create incidents for other companies." }, { status: 403 });
    }

    const companyId = company.companyId;
    const body = await req.json();

    const { title, description, category, severity, latitude, longitude, affectedRadiusKm, recommendedAction } = body as {
      title:              string;
      description:        string;
      category:           IncidentCategory;
      severity:           "low" | "medium" | "high" | "critical";
      latitude:           number;
      longitude:          number;
      affectedRadiusKm?:  number;
      recommendedAction?: string;
    };

    if (!title || typeof title !== "string") return NextResponse.json({ error: "title is required" }, { status: 400 });
    if (!category) return NextResponse.json({ error: "category is required" }, { status: 400 });
    if (!severity) return NextResponse.json({ error: "severity is required" }, { status: 400 });
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "latitude and longitude are required numbers" }, { status: 400 });
    }

    const now       = new Date().toISOString();
    const incident: Incident = {
      incidentId:         `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      companyId,
      title:              title.slice(0, 150),
      description:        (description ?? "").slice(0, 300),
      category,
      severity,
      confidence:         90,
      latitude,
      longitude,
      affectedRadiusKm:   typeof affectedRadiusKm === "number" ? affectedRadiusKm : 50,
      startTime:          now,
      lastUpdated:        now,
      source:             `Manual:${userRecord.name ?? userRecord.userId}`,
      verifiedStatus:     true,
      impactScore:        severity === "critical" ? 90 : severity === "high" ? 70 : severity === "medium" ? 50 : 25,
      recommendedAction:  recommendedAction ?? (
        severity === "critical" ? "Reroute immediately" :
        severity === "high"     ? "Evaluate alternate routes" :
        "Monitor situation"
      ),
    };

    await storeIncident(incident);

    createIntelligenceAudit({
      companyId,
      incidentId: incident.incidentId,
      userId:     userRecord.userId,
      eventType:  "incident_detected",
      source:     "ManualReport",
      metadata:   { title: incident.title, category, severity, latitude, longitude },
    }).catch(() => {});

    return NextResponse.json({ incident }, { status: 201 });
  } catch (err: any) {
    if (err instanceof Response) return new NextResponse(err.body, { status: err.status, headers: { "Content-Type": "application/json" } });
    console.error("[POST /api/intelligence/incidents]", err);
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 });
  }
}
