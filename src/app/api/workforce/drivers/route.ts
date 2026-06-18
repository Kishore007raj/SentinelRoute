import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import { requireWorkforceRead, requireWorkforceWrite, handleAuthError } from "@/lib/auth-helpers";
import { createWorkforceAuditEvent } from "@/lib/workforce-audit";
import { AADHAAR_ENCRYPTION_KEY } from "@/lib/env";
import type { Driver } from "@/lib/types";

/**
 * GET /api/workforce/drivers
 * POST /api/workforce/drivers
 */

// ─── AES-256 Encryption ───────────────────────────────────────────────────────

const IV_LENGTH = 16;

function encryptAadhaar(text: string): string {
  const key = AADHAAR_ENCRYPTION_KEY();
  if (!text || !key) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key.slice(0, 32)),
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

// ─── GET /api/workforce/drivers ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let companyId: string;
  let userRecord: Awaited<ReturnType<typeof requireWorkforceRead>>["userRecord"];

  try {
    const auth = await requireWorkforceRead(req);
    companyId  = auth.companyId;
    userRecord = auth.userRecord;
  } catch (err) {
    return handleAuthError(err);
  }

  // super_admin must supply ?companyId= to scope the query
  if (userRecord.role === "super_admin" && !companyId) {
    return NextResponse.json(
      { error: "super_admin must provide ?companyId= query parameter" },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    const query: Record<string, unknown> = { companyId };

    const docs = await db
      .collection("drivers")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Omit aadhaarNumber from list response entirely
    const drivers = docs.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, aadhaarNumber, ...rest } = doc;
      return rest as Omit<Driver, "aadhaarNumber">;
    });

    // Task 7: audit super_admin cross-company reads (fire-and-forget)
    if (userRecord.role === "super_admin") {
      createWorkforceAuditEvent({
        db,
        companyId,
        eventType:  "super_admin_read",
        actorId:    userRecord.userId,
        targetId:   companyId,
        targetType: "driver",
        details:    { action: "list_drivers", endpoint: "/api/workforce/drivers" },
      }).catch(() => {/* audit failures never crash the caller */});
    }

    return NextResponse.json({ drivers, total: drivers.length });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/workforce/drivers] DB error:", detail);
    return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 503 });
  }
}

// ─── POST /api/workforce/drivers ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
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

  // Validate required fields
  const requiredFields = ["fullName", "phone", "licenseNumber", "licenseExpiry"] as const;
  for (const field of requiredFields) {
    const value = body[field];
    if (!value || typeof value !== "string" || value.trim() === "") {
      return NextResponse.json(
        { error: `Missing or empty required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const now      = new Date().toISOString();
  const driverId = `drv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Encrypt aadhaarNumber if provided
  const aadhaarRaw = typeof body.aadhaarNumber === "string" ? body.aadhaarNumber : "";
  const aadhaarEncrypted = aadhaarRaw ? encryptAadhaar(aadhaarRaw) : "";

  const driver: Driver = {
    driverId,
    companyId,
    employeeId:             typeof body.employeeId === "string" ? body.employeeId : "",
    fullName:               (body.fullName as string).trim(),
    phone:                  (body.phone as string).trim(),
    email:                  typeof body.email === "string" ? body.email : "",
    licenseNumber:          (body.licenseNumber as string).trim(),
    licenseExpiry:          (body.licenseExpiry as string).trim(),
    aadhaarNumber:          aadhaarEncrypted,
    bloodGroup:             typeof body.bloodGroup === "string" ? body.bloodGroup : "",
    languagePreferences:    Array.isArray(body.languagePreferences)
                              ? (body.languagePreferences as string[])
                              : [],
    address:                typeof body.address === "string" ? body.address : "",
    // ─── Status defaults ────────────────────────────────────────────────────
    status:                 "active",
    assignedVehicleId:      null,
    // ─── Module 3/4/5 future-compat fields ─────────────────────────────────
    shipmentIds:            [],
    communicationChannelId: null,
    preferredLanguage:      "en",
    // ─── Timestamps ─────────────────────────────────────────────────────────
    createdAt:              now,
    updatedAt:              now,
  };

  try {
    const db = await getDb();

    await db.collection("drivers").insertOne({ ...driver });

    // Fire-and-forget audit event — failure must never block the response
    createWorkforceAuditEvent({
      db,
      companyId,
      eventType:  "driver_created",
      actorId:    userId,
      targetId:   driverId,
      targetType: "driver",
    }).catch((err) =>
      console.error("[POST /api/workforce/drivers] Audit error (ignored):", err)
    );

    // Task 3: never return encrypted Aadhaar value — mask in create response
    const { aadhaarNumber: _aadhaar, ...driverSafe } = driver;
    return NextResponse.json({ driver: { ...driverSafe, aadhaarNumber: "****" } }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/workforce/drivers] DB insert error:", detail);
    return NextResponse.json({ error: `Failed to create driver: ${detail}` }, { status: 500 });
  }
}
