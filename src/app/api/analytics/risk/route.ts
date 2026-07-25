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
          riskTrend: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
                avgOverallRisk: { $avg: "$riskFactors.overall" },
                avgWeatherRisk: { $avg: "$riskFactors.weather" },
                avgTrafficRisk: { $avg: "$riskFactors.traffic" },
                avgSecurityRisk: { $avg: "$riskFactors.security" }
              }
            },
            { $sort: { _id: 1 } }
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalCalculations: { $sum: 1 },
                avgOverallRisk: { $avg: "$riskFactors.overall" }
              }
            }
          ]
        }
      }
    ];

    const results = await db.collection("risk_calculations").aggregate(pipeline).toArray();
    const data = results[0];

    const formattedData = {
      summary: data.summary[0] || { totalCalculations: 0, avgOverallRisk: 0 },
      riskTrend: data.riskTrend.map((d: { _id: string; avgOverallRisk: number; avgWeatherRisk: number; avgTrafficRisk: number; avgSecurityRisk: number }) => ({
        date:     d._id,
        overall:  d.avgOverallRisk,
        weather:  d.avgWeatherRisk,
        traffic:  d.avgTrafficRisk,
        security: d.avgSecurityRisk,
      }))
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    return handleAuthError(error);
  }
}
