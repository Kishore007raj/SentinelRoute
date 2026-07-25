import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { addTimelineEvent } from "@/lib/timeline-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import { utcNow } from "@/lib/time";
import type { Driver, Vehicle } from "@/lib/types";

/**
 * POST /api/shipments/[id]/assign
 *
 * Assigns a driver and/or vehicle to a shipment.
 *
 * Validates:
 * - Driver exists and is active (not suspended/inactive)
 * - Vehicle exists and is available
 * - No expired documents on vehicle (insurance, fitness, permit)
 * - Driver licence not expired
 * - Neither already assigned to another active shipment
 *
 * On success:
 * - Updates shipment with assignedDriverId/Name and assignedVehicleId/Number
 * - Updates vehicle status to "assigned"
 * - Updates vehicle.currentDriverId
 * - Updates driver.assignedVehicleId
 * - Writes timeline event
 * - Writes audit record
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  let companyId: string;

  try {
    const auth = await requireApprovedCompany(req);
    userId    = auth.userId;
    companyId = auth.company.companyId;
  } catch (err) {
    return handleAuthError(err);
  }

  const { id: shipmentId } = await params;
  if (!shipmentId) {
    return NextResponse.json({ error: "Missing shipment id" }, { status: 400 });
  }

  let body: { driverId?: unknown; vehicleId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { driverId, vehicleId } = body;
  if (!driverId && !vehicleId) {
    return NextResponse.json(
      { error: "At least one of driverId or vehicleId is required" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const now = utcNow();

  // ── Verify shipment exists and belongs to this company ────────────────────
  const shipmentDoc = await db.collection("shipments").findOne({ id: shipmentId, companyId });
  if (!shipmentDoc) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  if (shipmentDoc.status === "completed" || shipmentDoc.status === "cancelled") {
    return NextResponse.json(
      { error: `Cannot assign resources to a ${String(shipmentDoc.status)} shipment` },
      { status: 400 }
    );
  }

  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const updateFields: Record<string, unknown> = { updatedAt: now, lastUpdate: now };
  const timelineLines: string[] = [];

  // ── Validate & prepare driver ─────────────────────────────────────────────
  let driverDoc: Driver | null = null;
  if (driverId && typeof driverId === "string") {
    driverDoc = await db.collection<Driver>("drivers").findOne({ driverId, companyId }) as Driver | null;

    if (!driverDoc) {
      return NextResponse.json({ error: "Driver not found in this company" }, { status: 404 });
    }
    if (driverDoc.status === "suspended" || driverDoc.status === "inactive") {
      return NextResponse.json(
        { error: `Driver is ${driverDoc.status} and cannot be assigned` },
        { status: 400 }
      );
    }
    if (driverDoc.licenseExpiry && driverDoc.licenseExpiry < today) {
      return NextResponse.json(
        { error: "Driver licence is expired - cannot assign" },
        { status: 400 }
      );
    }
    // Check driver not already assigned to another active shipment
    const conflictShipment = await db.collection("shipments").findOne({
      companyId,
      assignedDriverId: driverId,
      status: { $in: ["active", "at-risk", "draft"] },
      id: { $ne: shipmentId },
    });
    if (conflictShipment) {
      return NextResponse.json(
        { error: `Driver is already assigned to shipment ${String(conflictShipment.id)}` },
        { status: 409 }
      );
    }

    updateFields.assignedDriverId   = driverId;
    updateFields.assignedDriverName = driverDoc.fullName;
    timelineLines.push(`Driver assigned: ${driverDoc.fullName}`);
  }

  // ── Validate & prepare vehicle ────────────────────────────────────────────
  let vehicleDoc: Vehicle | null = null;
  if (vehicleId && typeof vehicleId === "string") {
    vehicleDoc = await db.collection<Vehicle>("vehicles").findOne({ vehicleId, companyId }) as Vehicle | null;

    if (!vehicleDoc) {
      return NextResponse.json({ error: "Vehicle not found in this company" }, { status: 404 });
    }
    if (vehicleDoc.status === "maintenance" || vehicleDoc.status === "inactive") {
      return NextResponse.json(
        { error: `Vehicle is ${vehicleDoc.status} and cannot be assigned` },
        { status: 400 }
      );
    }
    if (vehicleDoc.insuranceExpiry && vehicleDoc.insuranceExpiry < today) {
      return NextResponse.json(
        { error: "Vehicle insurance has expired - cannot assign" },
        { status: 400 }
      );
    }
    if (vehicleDoc.fitnessExpiry && vehicleDoc.fitnessExpiry < today) {
      return NextResponse.json(
        { error: "Vehicle fitness certificate has expired - cannot assign" },
        { status: 400 }
      );
    }
    if (vehicleDoc.permitExpiry && vehicleDoc.permitExpiry < today) {
      return NextResponse.json(
        { error: "Vehicle permit has expired - cannot assign" },
        { status: 400 }
      );
    }
    // Check vehicle not already assigned to another active shipment
    const conflictShipment = await db.collection("shipments").findOne({
      companyId,
      assignedVehicleId: vehicleId,
      status: { $in: ["active", "at-risk", "draft"] },
      id: { $ne: shipmentId },
    });
    if (conflictShipment) {
      return NextResponse.json(
        { error: `Vehicle is already assigned to shipment ${String(conflictShipment.id)}` },
        { status: 409 }
      );
    }

    updateFields.assignedVehicleId     = vehicleId;
    updateFields.assignedVehicleNumber = vehicleDoc.vehicleNumber;
    timelineLines.push(`Vehicle assigned: ${vehicleDoc.vehicleNumber} (${vehicleDoc.vehicleType})`);
  }

  try {
    // ── Update shipment ───────────────────────────────────────────────────────
    await db.collection("shipments").updateOne(
      { id: shipmentId, companyId },
      { $set: updateFields }
    );

    // ── Update vehicle status ─────────────────────────────────────────────────
    if (vehicleDoc) {
      await db.collection("vehicles").updateOne(
        { vehicleId: vehicleDoc.vehicleId, companyId },
        {
          $set: {
            status:          "assigned",
            operationalStatus: "Assigned",
            currentDriverId: driverDoc?.driverId ?? vehicleDoc.currentDriverId,
            updatedAt:       now,
          },
        }
      );
    }

    // ── Update driver's assigned vehicle ──────────────────────────────────────
    if (driverDoc && vehicleDoc) {
      await db.collection("drivers").updateOne(
        { driverId: driverDoc.driverId, companyId },
        { $set: { assignedVehicleId: vehicleDoc.vehicleId, operationalStatus: "Assigned", updatedAt: now } }
      );
    }

    // ── Store assignment record ───────────────────────────────────────────────
    // Write a record whenever at least one resource is assigned (not just paired)
    if (driverDoc || vehicleDoc) {
      const assignment = {
        assignmentId:  `asgn-${shipmentId}-${Date.now()}`,
        shipmentId,
        companyId,
        driverId:      driverDoc?.driverId ?? null,
        driverName:    driverDoc?.fullName ?? null,
        vehicleId:     vehicleDoc?.vehicleId ?? null,
        vehicleNumber: vehicleDoc?.vehicleNumber ?? null,
        assignedBy:    userId,
        assignedAt:    now,
        active:        true,
      };
      await db.collection("shipment_assignments").insertOne(assignment);
    }

    // ── Timeline & audit (fire-and-forget) ───────────────────────────────────
    if (timelineLines.length > 0) {
      addTimelineEvent(
        shipmentId, companyId,
        "Dispatch Started",
        timelineLines.join(". ") + ".",
        "SentinelRoute", 100,
        ["assignedDriverId", "assignedVehicleId"]
      ).catch(() => {});
    }

    createIntelligenceAudit({
      companyId, shipmentId, userId,
      eventType: "shipment_assigned",
      source:    "ShipmentAssignRoute",
      metadata:  {
        driverId:      driverDoc?.driverId,
        driverName:    driverDoc?.fullName,
        vehicleId:     vehicleDoc?.vehicleId,
        vehicleNumber: vehicleDoc?.vehicleNumber,
      },
    }).catch(() => {});

    // Return updated shipment
    const updatedDoc = await db.collection("shipments").findOne({ id: shipmentId, companyId });
    if (!updatedDoc) {
      return NextResponse.json({ error: "Shipment not found after update" }, { status: 500 });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, userId: _uid, ...shipment } = updatedDoc;
    return NextResponse.json({ shipment });
  } catch (err) {
    console.error("[POST /api/shipments/[id]/assign] DB error:", err);
    return NextResponse.json({ error: "Failed to assign resources" }, { status: 500 });
  }
}
