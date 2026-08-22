import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { getOperationalAlerts } from "@/lib/alert-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

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
        source:    "AlertsRoute",
        metadata: {
          companyIdViewed: companyId,
          endpoint:        "/api/intelligence/alerts",
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    } else {
      // Regular users: require company and use their own company ID
      const companyResult = await requireCompany(req);
      companyId = companyResult.company.companyId;
    }

    const alerts = await getOperationalAlerts(companyId);
    return NextResponse.json({ alerts });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
