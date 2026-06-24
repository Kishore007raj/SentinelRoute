import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getOperationalAlerts } from "@/lib/alert-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

export async function GET(req: Request) {
  try {
    const { userRecord, company } = await requireCompany(req as any);
    const companyId = company.companyId;
    const isSuperAdmin = userRecord.role === "super_admin";

    // ── Super admin cross-company read audit ─────────────────────────────────
    if (isSuperAdmin) {
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "AlertsRoute",
        metadata: {
          companyIdViewed: companyId,
          endpoint:        "/api/intelligence/alerts",
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    }

    const alerts = await getOperationalAlerts(companyId);
    return NextResponse.json({ alerts });
  } catch (err: any) {
    if (err instanceof Response) {
      return new NextResponse(err.body, { status: err.status, headers: { "Content-Type": "application/json" } });
    }
    console.error("[GET /api/intelligence/alerts]", err);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
