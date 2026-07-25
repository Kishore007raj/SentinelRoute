import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const db = await getDb();
    
    const matchStage = { companyId: company.companyId };
    
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
                total: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];

    const results = await db.collection("vehicles").aggregate(pipeline).toArray();
    const data = results[0];

    const formattedData = {
      summary: data.summary[0] || { total: 0 },
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
