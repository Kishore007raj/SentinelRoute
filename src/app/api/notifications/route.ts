import { NextResponse, NextRequest } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const { userId, company } = await requireCompany(req);

    const db = await getDb();
    const notifications = await db.collection("notifications").find({
      companyId: company.companyId,
      userId: userId,
    }).sort({ createdAt: -1 }).limit(50).toArray();

    return NextResponse.json({ data: notifications }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
