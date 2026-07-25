import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { KPIEngine } from "@/lib/analytics/kpi-engine";
import { DateRangePreset } from "@/lib/analytics/analytics-utils";

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const searchParams = req.nextUrl.searchParams;

    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;
    const preset = (searchParams.get("preset") as DateRangePreset) || undefined;

    const dateRange = { start, end, preset };

    const kpis = await KPIEngine.getAllKPIs(company.companyId, dateRange);

    const response = NextResponse.json(kpis);
    // Cache for 30 seconds
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=59");

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
