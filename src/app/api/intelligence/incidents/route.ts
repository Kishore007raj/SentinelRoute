import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getActiveIncidents } from "@/lib/intelligence-service";

export async function GET(req: Request) {
  try {
    const { company } = await requireCompany(req as any);
    const companyId = company.companyId;
    
    // Fetch live active incidents (mix of real + deterministic for demo)
    const incidents = await getActiveIncidents(companyId);

    return NextResponse.json({ incidents });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/intelligence/incidents]", err);
    return NextResponse.json({ error: "Failed to fetch incidents" }, { status: 500 });
  }
}
