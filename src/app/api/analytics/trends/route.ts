import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { TrendEngine } from "@/lib/analytics/trend-engine";
import { DateRangePreset } from "@/lib/analytics/analytics-utils";

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const searchParams = req.nextUrl.searchParams;

    const metric = searchParams.get("metric") as any;
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;
    const preset = (searchParams.get("preset") as DateRangePreset) || undefined;
    const granularity = (searchParams.get("granularity") as any) || "daily";

    if (!metric) {
      return NextResponse.json({ error: "Missing required parameter: metric" }, { status: 400 });
    }

    const dateRange = { start, end, preset };
    const trendData = await TrendEngine.getTrendData(company.companyId, metric, dateRange, granularity);

    const response = NextResponse.json({ trend: trendData });
    // Cache for 30 seconds
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=59");

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
