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
    const matchStage: Record<string, unknown> = { companyId: company.companyId };
    
    if (dateFilter) {
      matchStage.createdAt = dateFilter;
    }

    const db = await getDb();
    
    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          confidenceTrend: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
                avgConfidence: { $avg: "$confidenceScore" },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                avgConfidence: { $avg: "$confidenceScore" }
              }
            }
          ]
        }
      }
    ];

    const results = await db.collection("route_predictions").aggregate(pipeline).toArray();
    const data = results[0];

    const formattedData = {
      summary: data.summary[0] || { total: 0, avgConfidence: 0 },
      confidenceTrend: data.confidenceTrend.map((d: any) => ({
        date: d._id,
        confidence: d.avgConfidence,
        volume: d.count
      }))
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    return handleAuthError(error);
  }
}
