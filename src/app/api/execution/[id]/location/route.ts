import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { utcNow } from "@/lib/time";
import { addTimelineEvent } from "@/lib/timeline-service";
import { geoapifyRoute } from "@/lib/geoapify";
import { DriverLocation, ShipmentCheckpoint } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedCompany(req);
    const { id: shipmentId } = await params;
    
    if (!shipmentId) {
      return NextResponse.json({ error: "Missing shipment ID" }, { status: 400 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { latitude, longitude, heading, speed, accuracy, recalculateETA } = body;
    
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    
    const db = await getDb();
    
    const execution = await db.collection("shipment_executions").findOne({
      shipmentId,
      companyId: auth.company.companyId
    });
    
    if (!execution || execution.status !== "driving") {
      return NextResponse.json({ error: "Execution not found or not currently driving" }, { status: 400 });
    }
    
    const now = utcNow();
    
    const newLocation: DriverLocation = {
      latitude,
      longitude,
      heading,
      speed,
      accuracy,
      timestamp: now
    };
    
    const historicalLocations = [...execution.historicalLocations, newLocation].slice(-100);
    
    const updatePayload: any = {
      lastKnownLocation: newLocation,
      historicalLocations,
      lastUpdated: now
    };
    
    if (speed !== undefined) {
      // Basic average/max speed tracking (very naive)
      updatePayload.maximumSpeed = Math.max(execution.maximumSpeed || 0, speed);
      updatePayload.averageSpeed = execution.averageSpeed 
        ? (execution.averageSpeed + speed) / 2 
        : speed;
    }
    
    let newETA = null;
    let deviationDetected = false;
    
    // Live ETA Calculation
    if (recalculateETA) {
      // Find the next pending checkpoint
      const nextCheckpoint = execution.checkpoints.find((cp: ShipmentCheckpoint) => cp.status === "pending");
      
      if (nextCheckpoint) {
        const routes = await geoapifyRoute(longitude, latitude, nextCheckpoint.longitude, nextCheckpoint.latitude);
        if (routes && routes.length > 0) {
          const route = routes[0];
          newETA = route.durationMinutes;
          
          // Simple deviation detection: if ETA to next checkpoint is drastically longer than expected (e.g. > 120 mins) 
          // or if they are way off route, we flag it. Here we just set a new currentETA string.
          updatePayload.currentETA = `${Math.ceil(newETA)} mins`;
          updatePayload.remainingDistance = route.distanceKm;
          
          // Optionally detect deviation if newETA is > 20% of previous ETA, or something similar
          // This would trigger an event.
          if (execution.currentETA) {
            const oldETAMins = parseInt(execution.currentETA.split(" ")[0]);
            if (!isNaN(oldETAMins) && newETA > oldETAMins * 1.5) { // 50% increase in ETA
              deviationDetected = true;
            }
          }
        }
      }
    }
    
    await db.collection("shipment_executions").updateOne(
      { shipmentId },
      { $set: updatePayload }
    );
    
    if (deviationDetected) {
      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Route Deviation" as any,
        "Significant route deviation detected based on current location and ETA.",
        "system",
        100
      );
    }
    
    return NextResponse.json({ success: true, location: newLocation, eta: updatePayload.currentETA });
  } catch (err) {
    return handleAuthError(err);
  }
}
