import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { buildDateFilter, DateRangePreset } from "@/lib/analytics/analytics-utils";

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const searchParams = req.nextUrl.searchParams;

    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;
    const preset = (searchParams.get("preset") as DateRangePreset) || undefined;

    const dateFilter = buildDateFilter({ start, end, preset });
    const matchStage: Record<string, unknown> = { companyId: company.companyId, type: "health_score" };
    
    if (dateFilter) {
      matchStage.calculatedAt = dateFilter;
    }

    const db = await getDb();
    
    // Aggregate operational metrics
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$calculatedAt" } } },
          avgScore: { $avg: "$value" }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await db.collection("operational_metrics").aggregate(pipeline).toArray();

    const formattedData = {
      healthTrend: results.map(d => ({ date: d._id, score: d.avgScore }))
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    return handleAuthError(error);
  }
}
