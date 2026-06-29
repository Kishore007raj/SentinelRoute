import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest
) {
  try {
    const auth = await requireApprovedCompany(req);
    
    const db = await getDb();
    const executions = await db.collection("shipment_executions").find({
      companyId: auth.company.companyId,
      status: { $in: ["pending", "driving", "paused"] }
    }).toArray();
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cleanExecutions = executions.map(({ _id, ...rest }) => rest);
    
    return NextResponse.json({ executions: cleanExecutions });
  } catch (err) {
    return handleAuthError(err);
  }
}
