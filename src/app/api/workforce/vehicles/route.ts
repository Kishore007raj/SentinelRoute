import { NextRequest, NextResponse } from "next/server";
import type { Vehicle } from "@/lib/types";
import { getDb } from "@/lib/mongodb";
import { requireWorkforceRead, requireWorkforceWrite, handleAuthError } from "@/lib/auth-helpers";
import { createWorkforceAuditEvent } from "@/lib/workforce-audit";

/**
 * GET /api/workforce/vehicles
 * Returns all vehicles scoped to the authenticated user's company.
 * super_admin must supply ?companyId= or receives 400.
 * No/invalid auth → 401.  Insufficient role → 403.
 *
 * POST /api/workforce/vehicles
 * Creates a new vehicle for the authenticated user's company.
 * super_admin → 403 (write blocked).
 * Missing required fields → 400.
 * Success → 201 { vehicle }.
 */

// ─── GET /api/workforce/vehicles ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireWorkforceRead>>;
  try {
    auth = await requireWorkforceRead(req);
  } catch (err) {
    return handleAuthError(err);
  }

  const { userId, userRecord, companyId } = auth;

  // super_admin must provide ?companyId= to scope the query
  if (userRecord.role === "super_admin" && !companyId) {
    return NextResponse.json(
      { error: "super_admin must supply ?companyId= to list vehicles." },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    const query: Record<string, unknown> = { companyId };

    const docs = await db
      .collection("vehicles")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const vehicles: Vehicle[] = docs.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = doc;
      return rest as Vehicle;
    });

    // Fire-and-forget audit for super_admin cross-company reads
    if (userRecord.role === "super_admin") {
      createWorkforceAuditEvent({
        db,
        companyId,
        eventType: "super_admin_read",
        actorId: userId,
        targetId: companyId,
        targetType: "vehicle",
        details: { action: "list_vehicles" },
      }).catch(() => {/* audit failures never crash the caller */});
    }

    return NextResponse.json({ vehicles, total: vehicles.length });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/workforce/vehicles] DB error:", detail);
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 503 });
  }
}

// ─── POST /api/workforce/vehicles ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireWorkforceWrite>>;
  try {
    auth = await requireWorkforceWrite(req);
  } catch (err) {
    return handleAuthError(err);
  }

  const { userId, companyId } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  const requiredFields = ["vehicleNumber", "vehicleType", "capacity"] as const;
  for (const field of requiredFields) {
    const value = body[field];
    if (!value || typeof value !== "string" || !(value as string).trim()) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const vehicleId = `veh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const vehicle: Vehicle = {
    vehicleId,
    companyId,

    // Required registration fields
    vehicleNumber:   (body.vehicleNumber  as string).trim(),
    vehicleType:     (body.vehicleType    as string).trim(),
    capacity:        (body.capacity       as string).trim(),

    // Optional fields — default to empty string if not provided
    fuelType:        typeof body.fuelType        === "string" ? body.fuelType        : "",
    insuranceNumber: typeof body.insuranceNumber === "string" ? body.insuranceNumber : "",
    insuranceExpiry: typeof body.insuranceExpiry === "string" ? body.insuranceExpiry : "",
    fitnessExpiry:   typeof body.fitnessExpiry   === "string" ? body.fitnessExpiry   : "",
    permitExpiry:    typeof body.permitExpiry     === "string" ? body.permitExpiry    : "",

    // Status defaults
    status:          "available",
    currentDriverId: null,

    // Future-module defaults
    shipmentIds:      [],
    trackingDeviceId: null,

    // Timestamps
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();

    await db.collection("vehicles").insertOne({ ...vehicle });

    // Fire-and-forget audit
    createWorkforceAuditEvent({
      db,
      companyId,
      eventType: "vehicle_added",
      actorId: userId,
      targetId: vehicleId,
      targetType: "vehicle",
      details: {
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType:   vehicle.vehicleType,
        capacity:      vehicle.capacity,
      },
    }).catch(() => {/* audit failures never crash the caller */});

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/workforce/vehicles] DB insert error:", detail);
    return NextResponse.json({ error: `Failed to create vehicle: ${detail}` }, { status: 500 });
  }
}
