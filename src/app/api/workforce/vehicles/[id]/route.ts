import { NextRequest, NextResponse } from "next/server";
import type { Db } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { Vehicle, Driver } from "@/lib/types";
import { getDb } from "@/lib/mongodb";
import {
  requireWorkforceRead,
  requireWorkforceWrite,
  handleAuthError,
} from "@/lib/auth-helpers";
import { createWorkforceAuditEvent } from "@/lib/workforce-audit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Remove MongoDB's _id field and return a typed Vehicle. */
function stripId(doc: Record<string, unknown> | null): Vehicle {
  if (!doc) return {} as unknown as Vehicle;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest as unknown as Vehicle;
}

// ─── Unassign helper ──────────────────────────────────────────────────────────

/**
 * Clears the bidirectional driver–vehicle link atomically (or standalone).
 * Accepts an optional MongoDB session for use inside a withTransaction block.
 */
async function unassignDriver(
  db: Db,
  vehicleId: string,
  currentDriverId: string | null,
  companyId: string,
  session?: import("mongodb").ClientSession
): Promise<void> {
  const now = new Date().toISOString();
  const vehicleOpts = session ? { session } : {};
  const driverOpts  = session ? { session } : {};

  await db.collection("vehicles").updateOne(
    { vehicleId, companyId },
    { $set: { currentDriverId: null, status: "available", updatedAt: now } },
    vehicleOpts
  );

  if (currentDriverId) {
    await db.collection("drivers").updateOne(
      { driverId: currentDriverId, companyId },
      { $set: { assignedVehicleId: null, updatedAt: now } },
      driverOpts
    );
  }
}

// ─── GET /api/workforce/vehicles/[id] ────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof requireWorkforceRead>>;
  try {
    auth = await requireWorkforceRead(req);
  } catch (err) {
    return handleAuthError(err);
  }

  const { companyId } = auth;
  const { id } = await params;

  try {
    const db = await getDb();

    const doc = await db.collection("vehicles").findOne({ vehicleId: id, companyId });
    if (!doc) {
      return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    }

    return NextResponse.json({ vehicle: stripId(doc as Record<string, unknown>) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[GET /api/workforce/vehicles/${id}] DB error:`, detail);
    return NextResponse.json({ error: "Failed to fetch vehicle." }, { status: 503 });
  }
}

// ─── PATCH /api/workforce/vehicles/[id] ──────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof requireWorkforceWrite>>;
  try {
    auth = await requireWorkforceWrite(req);
  } catch (err) {
    return handleAuthError(err);
  }

  const { userId, companyId } = auth;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const db    = await getDb();
    const client = await clientPromise;
    const now   = new Date().toISOString();

    // ── Fetch the target vehicle ───────────────────────────────────────────
    const vehicleDoc = await db
      .collection("vehicles")
      .findOne({ vehicleId: id, companyId });

    if (!vehicleDoc) {
      return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    }

    const vehicleNow = vehicleDoc as unknown as Vehicle;

    // ── Case 1: Assign (currentDriverId is a non-null string) ─────────────
    if ("currentDriverId" in body && typeof body.currentDriverId === "string") {
      const newDriverId = body.currentDriverId as string;

      // Fetch driver — must belong to same company
      const driverDoc = await db
        .collection("drivers")
        .findOne({ driverId: newDriverId, companyId });

      if (!driverDoc) {
        return NextResponse.json(
          { error: "Driver not found or does not belong to this company." },
          { status: 404 }
        );
      }

      const driver = driverDoc as unknown as Driver;

      // Pre-condition checks (before opening session)
      if (driver.status === "suspended") {
        return NextResponse.json(
          { error: "Driver is suspended and cannot be assigned." },
          { status: 409 }
        );
      }

      if (driver.assignedVehicleId !== null) {
        return NextResponse.json(
          { error: "Driver is already assigned to another vehicle." },
          { status: 409 }
        );
      }

      const assignableStatuses: Vehicle["status"][] = ["available", "assigned"];
      if (!assignableStatuses.includes(vehicleNow.status)) {
        return NextResponse.json(
          { error: "Vehicle is not available for assignment." },
          { status: 409 }
        );
      }

      // MongoDB session — atomic bidirectional assignment
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          await db.collection("vehicles").updateOne(
            { vehicleId: id, companyId },
            { $set: { currentDriverId: newDriverId, status: "assigned", updatedAt: now } },
            { session }
          );
          await db.collection("drivers").updateOne(
            { driverId: newDriverId, companyId },
            { $set: { assignedVehicleId: id, updatedAt: now } },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }

      // Fire-and-forget audit
      createWorkforceAuditEvent({
        db, companyId,
        eventType:  "vehicle_assigned",
        actorId:    userId,
        targetId:   id,
        targetType: "vehicle",
        details:    { driverId: newDriverId },
      }).catch(() => {/* audit failures never crash the caller */});

      const updated = await db.collection("vehicles").findOne({ vehicleId: id, companyId });
      return NextResponse.json({ vehicle: stripId(updated) });
    }

    // ── Case 2: Unassign (currentDriverId explicitly null) ────────────────
    if ("currentDriverId" in body && body.currentDriverId === null) {
      const currentDriverId = vehicleNow.currentDriverId;

      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          await unassignDriver(db, id, currentDriverId, companyId, session);
        });
      } finally {
        await session.endSession();
      }

      createWorkforceAuditEvent({
        db, companyId,
        eventType:  "vehicle_unassigned",
        actorId:    userId,
        targetId:   id,
        targetType: "vehicle",
        details:    { previousDriverId: currentDriverId ?? null },
      }).catch(() => {/* audit failures never crash the caller */});

      const updated = await db.collection("vehicles").findOne({ vehicleId: id, companyId });
      return NextResponse.json({ vehicle: stripId(updated) });
    }

    // ── Case 3: Maintenance ───────────────────────────────────────────────
    if (body.status === "maintenance") {
      if (vehicleNow.currentDriverId) {
        const session = client.startSession();
        try {
          await session.withTransaction(async () => {
            await unassignDriver(db, id, vehicleNow.currentDriverId, companyId, session);
          });
        } finally {
          await session.endSession();
        }
      }

      await db.collection("vehicles").updateOne(
        { vehicleId: id, companyId },
        { $set: { status: "maintenance", updatedAt: now } }
      );

      createWorkforceAuditEvent({
        db, companyId,
        eventType:  "vehicle_maintenance",
        actorId:    userId,
        targetId:   id,
        targetType: "vehicle",
        details:    { previousDriverId: vehicleNow.currentDriverId ?? null },
      }).catch(() => {/* audit failures never crash the caller */});

      const updated = await db.collection("vehicles").findOne({ vehicleId: id, companyId });
      return NextResponse.json({ vehicle: stripId(updated) });
    }

    // ── Case 4: General field update ──────────────────────────────────────
    // Strip fields that must not be overwritten directly via a plain PATCH
    const {
      vehicleId: _vid,
      companyId: _cid,
      createdAt: _cat,
      currentDriverId: _drv,
      status: _sta,
      ...allowedFields
    } = body;

    await db.collection("vehicles").updateOne(
      { vehicleId: id, companyId },
      { $set: { ...allowedFields, updatedAt: now } }
    );

    createWorkforceAuditEvent({
      db, companyId,
      eventType:  "vehicle_updated",
      actorId:    userId,
      targetId:   id,
      targetType: "vehicle",
      details:    { updatedFields: Object.keys(allowedFields) },
    }).catch(() => {/* audit failures never crash the caller */});

    const updated = await db.collection("vehicles").findOne({ vehicleId: id, companyId });
    return NextResponse.json({ vehicle: stripId(updated) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[PATCH /api/workforce/vehicles/${id}] error:`, detail);
    return NextResponse.json({ error: "Failed to update vehicle." }, { status: 500 });
  }
}

// ─── DELETE /api/workforce/vehicles/[id] ─────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof requireWorkforceWrite>>;
  try {
    auth = await requireWorkforceWrite(req);
  } catch (err) {
    return handleAuthError(err);
  }

  const { userId, companyId } = auth;
  const { id } = await params;

  try {
    const db    = await getDb();
    const client = await clientPromise;
    const now   = new Date().toISOString();

    const vehicleDoc = await db
      .collection("vehicles")
      .findOne({ vehicleId: id, companyId });

    if (!vehicleDoc) {
      return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    }

    const vehicleNow = vehicleDoc as unknown as Vehicle;

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        // Unassign driver first if one is currently assigned
        if (vehicleNow.currentDriverId) {
          await unassignDriver(db, id, vehicleNow.currentDriverId, companyId, session);
        }

        // Soft-delete: mark inactive
        await db.collection("vehicles").updateOne(
          { vehicleId: id, companyId },
          { $set: { status: "inactive", updatedAt: now } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    createWorkforceAuditEvent({
      db, companyId,
      eventType:  "vehicle_activated", // design note: maps to "inactive" soft-delete
      actorId:    userId,
      targetId:   id,
      targetType: "vehicle",
      details:    { previousDriverId: vehicleNow.currentDriverId ?? null, action: "soft_delete" },
    }).catch(() => {/* audit failures never crash the caller */});

    const updated = await db.collection("vehicles").findOne({ vehicleId: id, companyId });
    return NextResponse.json({ vehicle: stripId(updated) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[DELETE /api/workforce/vehicles/${id}] error:`, detail);
    return NextResponse.json({ error: "Failed to delete vehicle." }, { status: 500 });
  }
}
