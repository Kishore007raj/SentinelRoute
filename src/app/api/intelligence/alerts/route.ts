import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getOperationalAlerts } from "@/lib/alert-service";

export async function GET(req: Request) {
  try {
    const { company } = await requireCompany(req as any);
    const companyId = company.companyId;
    
    const alerts = await getOperationalAlerts(companyId);

    return NextResponse.json({ alerts });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/intelligence/alerts]", err);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
