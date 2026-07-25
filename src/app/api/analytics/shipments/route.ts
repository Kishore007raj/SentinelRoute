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
    
    // Aggregate status distribution and volume
    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          statusDistribution: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          dailyVolume: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
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
                avgDistance: { $avg: "$route.distance" },
                avgDuration: { $avg: "$route.duration" }
              }
            }
          ]
        }
      }
    ];

    const results = await db.collection("shipments").aggregate(pipeline).toArray();
    const data = results[0];

    const formattedData = {
      summary: data.summary[0] || { total: 0, avgDistance: 0, avgDuration: 0 },
      statusDistribution: data.statusDistribution.reduce((acc: Record<string, number>, curr: { _id: string; count: number }) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      dailyVolume: data.dailyVolume.map((d: { _id: string; count: number }) => ({ date: d._id, volume: d.count }))
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    return handleAuthError(error);
  }
}
