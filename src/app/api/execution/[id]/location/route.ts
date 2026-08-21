import { NextRequest, NextResponse } from "next/server";
import * as turf from "@turf/turf";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { utcNow } from "@/lib/time";
import { addTimelineEvent } from "@/lib/timeline-service";
import { geoapifyRoute } from "@/lib/geoapify";
import { DriverLocation, ShipmentCheckpoint, TimelineEventType } from "@/lib/types";
import { emitToCompany } from "@/lib/socket-server";

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
    
    const updatePayload: Record<string, unknown> = {
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
    
    // ------------------------------------------

    // inside POST function after `let deviationDetected = false;`

    // Geofence Engine: Check for arrival
    const nextPendingCheckpointIndex = execution.checkpoints.findIndex((cp: ShipmentCheckpoint) => cp.status === "pending");
    const nextPendingCheckpoint = nextPendingCheckpointIndex !== -1 ? execution.checkpoints[nextPendingCheckpointIndex] : null;

    if (nextPendingCheckpoint && typeof nextPendingCheckpoint.latitude === "number" && typeof nextPendingCheckpoint.longitude === "number") {
      const currentPoint = turf.point([longitude, latitude]);
      const targetPoint = turf.point([nextPendingCheckpoint.longitude, nextPendingCheckpoint.latitude]);
      const distMeters = turf.distance(currentPoint, targetPoint, { units: "meters" });
      
      if (distMeters < 500) {
        // Auto-trigger arrival
        const updatedCheckpoints = [...execution.checkpoints];
        updatedCheckpoints[nextPendingCheckpointIndex] = {
          ...nextPendingCheckpoint,
          status: "arrived",
          arrivalTime: now
        };
        updatePayload.checkpoints = updatedCheckpoints;
        updatePayload.currentCheckpoint = nextPendingCheckpoint.id;
        
        await addTimelineEvent(
          shipmentId,
          auth.company.companyId,
          "Checkpoint Arrived",
          `Auto-arrived at checkpoint: ${nextPendingCheckpoint.name} (Distance: ${Math.round(distMeters)}m)`,
          "system",
          100
        );
      }
    }

    // Geofence Engine: Departure detection — if driver has 'arrived' and is now >800m away, mark as departed
    const arrivedCheckpointIndex = execution.checkpoints.findIndex((cp: ShipmentCheckpoint) => cp.status === "arrived");
    if (arrivedCheckpointIndex !== -1) {
      const arrivedCheckpoint = execution.checkpoints[arrivedCheckpointIndex];
      const currentPoint = turf.point([longitude, latitude]);
      const arrivedPoint = turf.point([arrivedCheckpoint.longitude, arrivedCheckpoint.latitude]);
      const departureDistMeters = turf.distance(currentPoint, arrivedPoint, { units: "meters" });
      
      if (departureDistMeters > 800) {
        const updatedCheckpoints = updatePayload.checkpoints 
          ? [...(updatePayload.checkpoints as ShipmentCheckpoint[])]
          : [...execution.checkpoints];
        updatedCheckpoints[arrivedCheckpointIndex] = {
          ...arrivedCheckpoint,
          status: "departed",
          departureTime: now,
        };
        updatePayload.checkpoints = updatedCheckpoints;
        updatePayload.completedCheckpoints = (execution.completedCheckpoints || 0) + 1;
        updatePayload.remainingCheckpoints = Math.max(0, (execution.remainingCheckpoints || 0) - 1);
        
        await addTimelineEvent(
          shipmentId,
          auth.company.companyId,
          "Checkpoint Departed",
          `Auto-departed from checkpoint: ${arrivedCheckpoint.name} (Distance from stop: ${Math.round(departureDistMeters)}m)`,
          "system",
          100
        );
      }
    }

    // Route Corridor Breach Detection using Turf.js pointToLineDistance
    // geometry is stored as [lng, lat] pairs (GeoJSON convention)
    const routeGeometry = execution.currentRoute?.geometry as Array<[number, number]> | undefined;
    if (routeGeometry && routeGeometry.length >= 2) {
      try {
        const routeLine = turf.lineString(routeGeometry); // geometry is [lng, lat]
        const driverPoint = turf.point([longitude, latitude]);
        const distToLine = turf.pointToLineDistance(driverPoint, routeLine, { units: "kilometers" });
        
        // 1.5 km corridor tolerance
        if (distToLine > 1.5) {
          deviationDetected = true;
          await addTimelineEvent(
            shipmentId,
            auth.company.companyId,
            "Route Corridor Breach",
            `Driver is ${(distToLine * 1000).toFixed(0)}m outside the planned route corridor.`,
            "system",
            100
          );
        }
      } catch (_) {
        // silently skip if route data is malformed
      }
    }

    // Live ETA Calculation
    if (recalculateETA) {
      if (nextPendingCheckpoint) {
        const routes = await geoapifyRoute(longitude, latitude, nextPendingCheckpoint.longitude, nextPendingCheckpoint.latitude);
        if (routes && routes.length > 0) {
          const route = routes[0];
          newETA = route.durationMinutes;
          
          updatePayload.currentETA = `${Math.ceil(newETA)} mins`;
          updatePayload.remainingDistance = route.distanceKm;
          
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
      { shipmentId, companyId: auth.company.companyId },
      { $set: updatePayload }
    );

    // Emit live location to all company subscribers immediately after DB write
    emitToCompany(auth.company.companyId, "driver:location", {
      shipmentId,
      driverId: execution.driverId,
      latitude,
      longitude,
      heading,
      speed,
      accuracy,
      timestamp: now,
      currentETA: updatePayload.currentETA ?? null,
      remainingDistance: updatePayload.remainingDistance ?? null,
      deviationDetected,
    });
    
    if (deviationDetected) {
      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Route Deviation",
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
