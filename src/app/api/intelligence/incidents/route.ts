import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getActiveIncidents } from "@/lib/intelligence-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

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

    // ── Super admin cross-company read audit ─────────────────────────────────
    if (isSuperAdmin && targetCompanyId) {
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "IncidentsRoute",
        metadata: {
          companyIdViewed: companyId,
          endpoint:        "/api/intelligence/incidents",
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    }

    const incidents = await getActiveIncidents(companyId);
    return NextResponse.json({ incidents });
  } catch (err: any) {
    if (err instanceof Response) {
      return new NextResponse(err.body, { status: err.status, headers: { "Content-Type": "application/json" } });
    }
    console.error("[GET /api/intelligence/incidents]", err);
    return NextResponse.json({ error: "Failed to fetch incidents" }, { status: 500 });
  }
}
