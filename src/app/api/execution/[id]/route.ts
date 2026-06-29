import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedCompany(req);
    const { id: shipmentId } = await params;
    
    if (!shipmentId) {
      return NextResponse.json({ error: "Missing shipment ID" }, { status: 400 });
    }
    
    const db = await getDb();
    const execution = await db.collection("shipment_executions").findOne({
      shipmentId,
      companyId: auth.company.companyId
    });
    
    if (!execution) {
      return NextResponse.json({ error: "Execution document not found" }, { status: 404 });
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...cleanExecution } = execution;
    return NextResponse.json({ execution: cleanExecution });
  } catch (err) {
    return handleAuthError(err);
  }
}
