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
          statusDistribution: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          typeDistribution: [
            { $group: { _id: "$type", count: { $sum: 1 } } }
          ],
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } }
              }
            }
          ]
        }
      }
    ];

    const results = await db.collection("operational_recommendations").aggregate(pipeline).toArray();
    const data = results[0];

    const summary = data.summary[0] || { total: 0, accepted: 0 };
    const acceptanceRate = summary.total > 0 ? (summary.accepted / summary.total) * 100 : 0;

    const formattedData = {
      summary: { ...summary, acceptanceRate },
      statusDistribution: data.statusDistribution.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      typeDistribution: data.typeDistribution.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    return handleAuthError(error);
  }
}
