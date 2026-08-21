import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const { userId: driverId, company } = await requireCompany(req);
    const companyId = company.companyId;
    const db = await getDb();
    
    // Aggregation pipeline to strictly calculate real metrics
    const pipeline = [
      { $match: { driverId, companyId, status: "completed" } },
      {
        $lookup: {
          from: "shipments",
          localField: "shipmentId",
          foreignField: "shipmentId",
          as: "shipmentDoc"
        }
      },
      { $unwind: { path: "$shipmentDoc", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalCompleted: { $sum: 1 },
          totalOnTime: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$tripEndTime", null] },
                    { $ne: ["$shipmentDoc.plannedArrival", null] },
                    { $lte: ["$tripEndTime", "$shipmentDoc.plannedArrival"] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    const aggResult = await db.collection("shipment_executions").aggregate(pipeline).toArray();
    const stats = aggResult[0] || { totalCompleted: 0, totalOnTime: 0 };

    const incidentsCount = await db.collection("incidents").countDocuments({
      "details.driverId": driverId,
      companyId
    });

    const activeExecution = await db.collection("shipment_executions").findOne({
      driverId,
      companyId,
      status: { $in: ["pending", "driving", "paused"] }
    });

    return NextResponse.json({
      analytics: {
        totalCompleted: stats.totalCompleted,
        totalOnTime: stats.totalOnTime,
        incidentsCount,
        hasActive: !!activeExecution
      }
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
