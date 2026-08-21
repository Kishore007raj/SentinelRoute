import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest
) {
  try {
    const auth = await requireApprovedCompany(req);
    const searchParams = req.nextUrl.searchParams;
    const driverId = searchParams.get("driverId");
    
    const db = await getDb();
    
    const query: Record<string, unknown> = {
      companyId: auth.company.companyId,
      status: { $in: ["pending", "driving", "paused"] }
    };
    
    if (driverId) {
      query.driverId = driverId;
    }
    
    const executions = await db.collection("shipment_executions").find(query).toArray();
    
    // Check for real pending assignments in the shipments collection
    let pendingAssignment = null;
    if (executions.length === 0 && driverId) {
      const pendingShipments = await db.collection("shipments").find({
        companyId: auth.company.companyId,
        assignedDriverId: driverId,
        status: "pending"
      }).toArray();
      
      if (pendingShipments.length > 0) {
        pendingAssignment = pendingShipments[0];
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cleanExecutions = executions.map(({ _id, ...rest }) => rest);
    
    return NextResponse.json({ 
      hasExecution: cleanExecutions.length > 0, 
      executions: cleanExecutions,
      pendingAssignment 
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
