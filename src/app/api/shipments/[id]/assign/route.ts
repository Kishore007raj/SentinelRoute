import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { addTimelineEvent } from "@/lib/timeline-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import { utcNow } from "@/lib/time";
import type { Driver, Vehicle } from "@/lib/types";
import { emitToCompany, emitToUser } from "@/lib/socket-server";
import { agentLog } from "@/lib/debug-agent-log";

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
    // (Conflict check moved inside transaction to prevent double-assignment race condition)

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
    // (Conflict check moved inside transaction to prevent double-assignment race condition)

    updateFields.assignedVehicleId     = vehicleId;
    updateFields.assignedVehicleNumber = vehicleDoc.vehicleNumber;
    timelineLines.push(`Vehicle assigned: ${vehicleDoc.vehicleNumber} (${vehicleDoc.vehicleType})`);
  }

  try {
    // ── Execute multi-document updates inside a transaction ────────────────────
    const { withTransaction } = await import("@/lib/mongodb");
    // #region agent log
    agentLog({ hypothesisId: "D", location: "assign/route.ts:beforeTxn", message: "assign about to withTransaction", data: { shipmentId, companyId, hasDriver: !!driverId, hasVehicle: !!vehicleId } });
    // #endregion
    await withTransaction(async (transactionDb, session) => {
      const opts = session ? { session } : {};

      // Conflict checks execute INSIDE the transaction so concurrent requests
      // cannot both pass the check and then both commit.
      // The status filter covers every "in-flight" status so that a driver or
      // vehicle already bound to a draft/pending/assigned shipment is blocked,
      // not just those on actively-running trips.
      if (driverId) {
        const driverConflict = await transactionDb.collection("shipments").findOne({
          companyId,
          assignedDriverId: driverId,
          status: { $in: ["draft", "pending", "assigned", "active", "at-risk"] },
          id: { $ne: shipmentId },
        }, opts);
        if (driverConflict) {
          throw new Error(`CONFLICT_DRIVER:${driverConflict.id}`);
        }
      }

      if (vehicleId) {
        const vehicleConflict = await transactionDb.collection("shipments").findOne({
          companyId,
          assignedVehicleId: vehicleId,
          status: { $in: ["draft", "pending", "assigned", "active", "at-risk"] },
          id: { $ne: shipmentId },
        }, opts);
        if (vehicleConflict) {
          throw new Error(`CONFLICT_VEHICLE:${vehicleConflict.id}`);
        }
      }
      
      // Update shipment
      await transactionDb.collection("shipments").updateOne(
        { id: shipmentId, companyId },
        { $set: updateFields },
        opts
      );

      // Update vehicle status
      if (vehicleDoc) {
        await transactionDb.collection("vehicles").updateOne(
          { vehicleId: vehicleDoc.vehicleId, companyId },
          {
            $set: {
              status:            "assigned",
              operationalStatus: "Assigned",
              currentDriverId:   driverDoc?.driverId ?? vehicleDoc.currentDriverId,
              updatedAt:         now,
            },
          },
          opts
        );
      }

      // Update driver's assigned vehicle
      if (driverDoc && vehicleDoc) {
        await transactionDb.collection("drivers").updateOne(
          { driverId: driverDoc.driverId, companyId },
          { $set: { assignedVehicleId: vehicleDoc.vehicleId, operationalStatus: "Assigned", updatedAt: now } },
          opts
        );
      }

      // Store assignment record
      if (driverDoc || vehicleDoc) {
        const assignment = {
          assignmentId:  `asgn-${randomUUID()}`,
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
        await transactionDb.collection("shipment_assignments").insertOne(assignment, opts);
      }
    });

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

    // Restore manual emission since Change Streams are disabled on Atlas M0
    emitToUser(userId, "shipment:updated", { shipment });
    emitToCompany(companyId, "shipment:updated", { shipment });

    // Also update driver availability state for dispatcher views
    if (driverDoc) {
      emitToCompany(companyId, "driver:availability", {
        driverId: driverDoc.driverId,
        operationalStatus: "Assigned",
      });
    }

    return NextResponse.json({ shipment });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.startsWith("CONFLICT_DRIVER:")) {
        const conflictId = err.message.split(":")[1];
        return NextResponse.json(
          { error: `Driver is already assigned to shipment ${conflictId}` },
          { status: 409 }
        );
      }
      if (err.message.startsWith("CONFLICT_VEHICLE:")) {
        const conflictId = err.message.split(":")[1];
        return NextResponse.json(
          { error: `Vehicle is already assigned to shipment ${conflictId}` },
          { status: 409 }
        );
      }
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/shipments/[id]/assign] DB error:", err);
    // #region agent log
    agentLog({ hypothesisId: "D", location: "assign/route.ts:catch", message: "assign failed", data: { detail: detail.slice(0, 500), shipmentId } });
    // #endregion
    return NextResponse.json({ error: "Failed to assign resources" }, { status: 500 });
  }
}
