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
    
    // Check for pending assignments if no execution is found (meaning driver hasn't accepted yet)
    if (executions.length === 0 && driverId) {
      const pendingShipments = await db.collection("shipments").find({
        companyId: auth.company.companyId,
        assignedDriverId: driverId,
        status: "pending"
      }).toArray();
      
      if (pendingShipments.length > 0) {
        // Return a mocked execution representing the assignment offer
        const s = pendingShipments[0];
        executions.push({
          _id: s._id,
          shipmentId: s.shipmentId,
          companyId: s.companyId,
          driverId: s.assignedDriverId,
          vehicleId: s.assignedVehicleId,
          plannedRoute: s.route,
          status: "pending",
          driverAccepted: false
        });
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cleanExecutions = executions.map(({ _id, ...rest }) => rest);
    
    return NextResponse.json({ executions: cleanExecutions });
  } catch (err) {
    return handleAuthError(err);
  }
}
