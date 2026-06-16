import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import clientPromise from "@/lib/mongodb";
import {
  requireWorkforceRead,
  requireWorkforceWrite,
  handleAuthError,
} from "@/lib/auth-helpers";
import { createWorkforceAuditEvent } from "@/lib/workforce-audit";
import type { Driver, UserRole } from "@/lib/types";

/**
 * GET /api/workforce/drivers/[id]
 * Returns a single driver record for the authenticated user's company.
 * - 404 if not found (hides existence from cross-company callers)
 * - Aadhaar masking: replaced with "****" unless role is company_manager,
 *   company_admin, or fleet_manager
 *
 * PATCH /api/workforce/drivers/[id]
 * Partial update of a driver record.
 * - status: "suspended"   → atomic session: clear vehicle assignment + audit driver_suspended
 * - status: "active"      → audit driver_activated
 * - other fields          → audit driver_updated
 *
 * DELETE /api/workforce/drivers/[id]
 * Soft-delete: sets status to "inactive" + updatedAt.
 * Audit: driver_suspended (maps to inactive per design).
 * Returns 200 { driver }.
 */

// ─── AES-256 Decryption ────────────────────────────────────────────────────────

const ENCRYPTION_KEY = process.env.AADHAAR_ENCRYPTION_KEY || "default-32-byte-key-for-dev-only!";

function decryptAadhaar(encrypted: string): string {
  if (!encrypted || !encrypted.includes(":")) return encrypted;
  try {
    const [ivHex, encryptedHex] = encrypted.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    // If decryption fails (e.g., value was never encrypted), return as-is
    return encrypted;
  }
}

// ─── Roles that may see unmasked aadhaar ──────────────────────────────────────

const AADHAAR_FULL_ACCESS_ROLES: UserRole[] = [
  "company_manager",
  "company_admin",
  "fleet_manager",
];

// ─── GET /api/workforce/drivers/[id] ─────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let companyId: string;
  let userRecord: Awaited<ReturnType<typeof requireWorkforceRead>>["userRecord"];

  try {
    const auth = await requireWorkforceRead(req);
    companyId  = auth.companyId;
    userRecord = auth.userRecord;
  } catch (err) {
    return handleAuthError(err);
  }

  // super_admin must have supplied ?companyId= — enforced by requireWorkforceRead
  if (userRecord.role === "super_admin" && !companyId) {
    return NextResponse.json(
      { error: "super_admin must provide ?companyId= query parameter" },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    const doc = await db
      .collection("drivers")
      .findOne({ driverId: id, companyId });

    if (!doc) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Strip MongoDB internal _id
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...driverDoc } = doc;
    const driver = driverDoc as Driver;

    // Aadhaar masking: decrypt for privileged roles, mask for everyone else
    if (AADHAAR_FULL_ACCESS_ROLES.includes(userRecord.role)) {
      driver.aadhaarNumber = decryptAadhaar(driver.aadhaarNumber);
    } else {
      driver.aadhaarNumber = "****";
    }

    return NextResponse.json({ driver });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[GET /api/workforce/drivers/${id}] DB error:`, detail);
    return NextResponse.json({ error: "Failed to fetch driver" }, { status: 503 });
  }
}

// ─── PATCH /api/workforce/drivers/[id] ───────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let companyId: string;
  let userId: string;

  try {
    const auth = await requireWorkforceWrite(req);
    companyId  = auth.companyId;
    userId     = auth.userId;
  } catch (err) {
    return handleAuthError(err);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate any provided required fields
  const requiredFields = ["fullName", "phone", "licenseNumber", "licenseExpiry"] as const;
  for (const field of requiredFields) {
    if (field in body) {
      const value = body[field];
      if (!value || typeof value !== "string" || value.trim() === "") {
        return NextResponse.json(
          { error: `Missing or empty required field: ${field}` },
          { status: 400 }
        );
      }
    }
  }

  try {
    const db = await getDb();

    // Fetch the current driver record
    const existing = await db
      .collection("drivers")
      .findOne({ driverId: id, companyId });

    if (!existing) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const newStatus = typeof body.status === "string" ? body.status : null;

    // ── Suspension: atomic session handles vehicle unassignment ──────────────
    if (newStatus === "suspended") {
      const currentVehicleId = existing.assignedVehicleId as string | null;

      const mongoClient = await clientPromise;
      const session = mongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          // Clear driver assignment + set suspended
          await db.collection("drivers").updateOne(
            { driverId: id, companyId },
            { $set: { assignedVehicleId: null, status: "suspended", updatedAt: now } },
            { session }
          );

          // Clear the vehicle's reference back to this driver
          if (currentVehicleId) {
            await db.collection("vehicles").updateOne(
              { vehicleId: currentVehicleId, companyId },
              { $set: { currentDriverId: null, status: "available", updatedAt: now } },
              { session }
            );
          }
        });
      } finally {
        await session.endSession();
      }

      // Fetch updated record
      const updated = await db
        .collection("drivers")
        .findOne({ driverId: id, companyId });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...updatedDoc } = updated!;

      // Fire-and-forget audit
      createWorkforceAuditEvent({
        db,
        companyId,
        eventType:  "driver_suspended",
        actorId:    userId,
        targetId:   id,
        targetType: "driver",
        details:    { previousVehicleId: currentVehicleId },
      }).catch((err) =>
        console.error(`[PATCH /api/workforce/drivers/${id}] Audit error (ignored):`, err)
      );

      return NextResponse.json({ driver: updatedDoc as Driver });
    }

    // ── Activation from suspended ─────────────────────────────────────────────
    const updateFields: Record<string, unknown> = { ...body, updatedAt: now };
    // Remove status from body to handle separately — already captured in newStatus
    delete updateFields.status;
    if (newStatus) updateFields.status = newStatus;

    await db.collection("drivers").updateOne(
      { driverId: id, companyId },
      { $set: updateFields }
    );

    const updated = await db
      .collection("drivers")
      .findOne({ driverId: id, companyId });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...updatedDoc } = updated!;

    // Determine audit event type
    let auditEventType: "driver_activated" | "driver_updated" = "driver_updated";
    if (newStatus === "active" && existing.status === "suspended") {
      auditEventType = "driver_activated";
    }

    createWorkforceAuditEvent({
      db,
      companyId,
      eventType:  auditEventType,
      actorId:    userId,
      targetId:   id,
      targetType: "driver",
      details:    { updatedFields: Object.keys(body) },
    }).catch((err) =>
      console.error(`[PATCH /api/workforce/drivers/${id}] Audit error (ignored):`, err)
    );

    return NextResponse.json({ driver: updatedDoc as Driver });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[PATCH /api/workforce/drivers/${id}] DB error:`, detail);
    return NextResponse.json({ error: `Failed to update driver: ${detail}` }, { status: 500 });
  }
}

// ─── DELETE /api/workforce/drivers/[id] ──────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let companyId: string;
  let userId: string;

  try {
    const auth = await requireWorkforceWrite(req);
    companyId  = auth.companyId;
    userId     = auth.userId;
  } catch (err) {
    return handleAuthError(err);
  }

  try {
    const db = await getDb();

    const existing = await db
      .collection("drivers")
      .findOne({ driverId: id, companyId });

    if (!existing) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Soft-delete: set status to "inactive"
    await db.collection("drivers").updateOne(
      { driverId: id, companyId },
      { $set: { status: "inactive", updatedAt: now } }
    );

    const updated = await db
      .collection("drivers")
      .findOne({ driverId: id, companyId });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...updatedDoc } = updated!;

    // Fire-and-forget audit — design maps inactive to driver_suspended
    createWorkforceAuditEvent({
      db,
      companyId,
      eventType:  "driver_suspended",
      actorId:    userId,
      targetId:   id,
      targetType: "driver",
      details:    { action: "soft_delete", previousStatus: existing.status },
    }).catch((err) =>
      console.error(`[DELETE /api/workforce/drivers/${id}] Audit error (ignored):`, err)
    );

    return NextResponse.json({ driver: updatedDoc as Driver });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[DELETE /api/workforce/drivers/${id}] DB error:`, detail);
    return NextResponse.json({ error: `Failed to delete driver: ${detail}` }, { status: 500 });
  }
}
