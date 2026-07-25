import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const db = await getDb();
    
    // For Company Analytics, we might just return the company profile and some high-level stats
    // that don't fit neatly into the other buckets, or summarize user roles.
    const usersPipeline = [
      { $match: { companyId: company.companyId } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ];

    const userResults = await db.collection("users").aggregate(usersPipeline).toArray();
    
    const roleDistribution = userResults.reduce((acc: any, curr: any) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const formattedData = {
      company: {
        id: company.companyId,
        name: company.companyName,
        status: company.status,
        createdAt: company.createdAt,
      },
      roleDistribution,
      totalUsers: userResults.reduce((sum, curr) => sum + curr.count, 0)
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    return handleAuthError(error);
  }
}
