import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getOperationalAlerts } from "@/lib/alert-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

export async function GET(req: NextRequest) {
  try {
    const { userRecord, company } = await requireCompany(req);
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
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
