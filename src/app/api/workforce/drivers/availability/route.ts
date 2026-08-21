import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const companyId = company.companyId;

    const db = await getDb();
    
    // Fetch all drivers for the company from the drivers collection
    const drivers = await db.collection("drivers").find({ companyId }).toArray();
    const driverIds = drivers.map(d => d.userId); // Assuming userId links to the auth user, or d.driverId

    // Fetch active shipments for these drivers
    const activeExecutions = await db.collection("shipment_executions").find({
      companyId,
      driverId: { $in: driverIds },
      status: { $in: ["pending", "driving", "paused"] }
    }).toArray();

    // Map driverId to active execution
    const executionMap = new Map();
    activeExecutions.forEach(ex => {
      executionMap.set(ex.driverId, ex);
    });

    const availability = drivers.map(driver => {
      const activeEx = executionMap.get(driver.userId);
      // We can also check driver.status if we keep an explicit status (available, offline, assigned)
      let status = driver.status || "available";
      
      if (activeEx) {
        status = activeEx.status === "driving" ? "driving" : "assigned";
      }

      return {
        driverId: driver.driverId,
        userId: driver.userId,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        status,
        currentShipmentId: activeEx ? activeEx.shipmentId : null
      };
    });

    return NextResponse.json({ availability });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireCompany(req);
    
    // In this context, the driver themselves is making the request, 
    // so we use the user's uid as the driver userId.
    const body = await req.json();
    const { isAvailable } = body;
    
    if (typeof isAvailable !== 'boolean') {
      return NextResponse.json({ error: "isAvailable boolean required" }, { status: 400 });
    }

    const db = await getDb();
    
    // Check if the user is actually a driver in the collection
    const driverDoc = await db.collection("drivers").findOne({ userId: userId });
    
    if (!driverDoc) {
      return NextResponse.json({ error: "Driver profile not found" }, { status: 404 });
    }

    const newStatus = isAvailable ? "available" : "unavailable";

    await db.collection("drivers").updateOne(
      { userId: userId },
      { 
        $set: { 
          status: newStatus,
          updatedAt: new Date().toISOString()
        } 
      }
    );

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    return handleAuthError(error);
  }
}
