import { dispatchEvent } from "@/lib/event-dispatcher";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { getActiveIncidents, storeIncident } from "@/lib/intelligence-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import type { Incident, IncidentCategory } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    // Get auth token first
    const { userId } = await requireAuth(req);
    
    // Fetch user record from DB
    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ userId });
    
    if (!userRecord) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    const isSuperAdmin = userRecord.role === "super_admin";
    let companyId: string;

    // Super admins: get target company from query param
    if (isSuperAdmin) {
      const url = new URL(req.url);
      const targetCompanyId = url.searchParams.get("companyId");
      
      if (!targetCompanyId) {
        return NextResponse.json({ error: "Super admin must specify companyId query parameter" }, { status: 400 });
      }

      companyId = targetCompanyId;

      // Audit super admin read
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "IncidentsRoute",
        metadata:  { companyIdViewed: companyId, endpoint: "/api/intelligence/incidents", timestamp: new Date().toISOString() },
      }).catch(() => {});
    } else {
      // Regular users: require company and use their own company ID
      const companyResult = await requireCompany(req);
      companyId = companyResult.company.companyId;
    }

    const incidents = await getActiveIncidents(companyId);
    return NextResponse.json({ incidents });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Regular users only - super admins cannot create incidents
    const { userRecord, company } = await requireCompany(req);

    if (userRecord.role === "super_admin") {
      return NextResponse.json({ error: "Super Admin may not create incidents." }, { status: 403 });
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
    dispatchEvent({ type: "INCIDENT_REPORTED", companyId, payload: { incidentId: incident.incidentId } });

    createIntelligenceAudit({
      companyId,
      incidentId: incident.incidentId,
      userId:     userRecord.userId,
      eventType:  "incident_detected",
      source:     "ManualReport",
      metadata:   { title: incident.title, category, severity, latitude, longitude },
    }).catch(() => {});

    return NextResponse.json({ incident }, { status: 201 });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
