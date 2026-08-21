import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { createAuditEvent } from "@/lib/audit";
import { addTimelineEvent } from "@/lib/timeline-service";
import { utcNow } from "@/lib/time";
import { nanoid } from "nanoid";
import { Incident } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedCompany(req);
    const body = await req.json();
    const { 
      title, 
      description, 
      category, 
      severity, 
      latitude, 
      longitude, 
      relatedShipmentId,
      estimatedDelayMinutes
    } = body;
    
    if (!title || !description || !category || !severity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const db = await getDb();
    const now = utcNow();
    
    let relatedDriverId = null;
    let relatedVehicleId = null;
    
    // If relatedShipmentId is provided, get driver and vehicle.
    // NOTE: the shipments collection uses field "id" as its primary key, not "shipmentId".
    if (relatedShipmentId) {
      const shipment = await db.collection("shipments").findOne({
        id: relatedShipmentId,
        companyId: auth.company.companyId
      });
      if (shipment) {
        relatedDriverId = shipment.assignedDriverId;
        relatedVehicleId = shipment.assignedVehicleId;
      }
    } else {
      // Maybe the user is a driver reporting an incident without a specific shipment ID context
      if (auth.userRecord.role === "driver") {
        relatedDriverId = auth.userRecord.userId;
        const driver = await db.collection("drivers").findOne({ driverId: auth.userRecord.userId });
        if (driver) {
          relatedVehicleId = driver.assignedVehicleId;
          const activeExecution = await db.collection("shipment_executions").findOne({
            driverId: driver.driverId,
            status: { $in: ["driving", "paused", "pending"] }
          });
          if (activeExecution) {
            // But we can't mutate a const above. Let's just create a new variable or overwrite body.relatedShipmentId
          }
        }
      }
    }
    
    const newIncident: Incident = {
      incidentId: `inc-${nanoid(8)}`,
      companyId: auth.company.companyId,
      ownerId: auth.userId,
      title,
      description,
      category,
      severity,
      commandStatus: "open",
      confidence: 100, // driver reported
      latitude: latitude || 0,
      longitude: longitude || 0,
      affectedRadiusKm: 1,
      startTime: now,
      lastUpdated: now,
      source: "Driver PWA",
      verifiedStatus: false,
      impactScore: severity === "critical" ? 90 : severity === "high" ? 75 : severity === "medium" ? 50 : 25,
      recommendedAction: "Investigate and coordinate with driver",
      relatedShipmentId: relatedShipmentId,
      relatedDriverId: relatedDriverId || undefined,
      relatedVehicleId: relatedVehicleId || undefined,
      estimatedDelayMinutes: estimatedDelayMinutes || 0
    };
    
    await db.collection("incidents").insertOne(newIncident);
    
    if (relatedShipmentId) {
      await addTimelineEvent(
        relatedShipmentId, 
        auth.company.companyId, 
        "Incident Reported", 
        title, 
        "alert", 
        severity === "critical" ? 100 : severity === "high" ? 75 : 50
      );
    }
    
    await createAuditEvent({
      db,
      companyId: auth.company.companyId,
      eventType: "incident_reported",
      performedBy: auth.userId,
      details: { incidentId: newIncident.incidentId, category, severity, relatedShipmentId }
    });
    
    return NextResponse.json({ success: true, incident: newIncident });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedCompany(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const shipmentId = searchParams.get("shipmentId");
    
    const db = await getDb();
    
    const query: any = { companyId: auth.company.companyId };
    
    if (status) {
      query.commandStatus = status;
    }
    if (shipmentId) {
      query.relatedShipmentId = shipmentId;
    }
    
    const incidents = await db.collection("incidents")
      .find(query)
      .sort({ startTime: -1 })
      .toArray();
      
    return NextResponse.json({ success: true, incidents });
  } catch (err) {
    return handleAuthError(err);
  }
}
