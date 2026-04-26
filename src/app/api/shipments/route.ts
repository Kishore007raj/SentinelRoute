import { NextRequest, NextResponse } from "next/server";
import type { Shipment, CreateShipmentRequest } from "@/lib/types";
import { generateShipmentCode, getRiskLabel } from "@/lib/utils";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { encryptObjectFields, decryptObjectFields } from "@/lib/encryption";
import { emitToUser } from "@/lib/socket-server";
import { utcNow } from "@/lib/time";

/**
 * GET /api/shipments
 * Returns shipments scoped to the authenticated user.
 * No/invalid auth → 401.
 * DB error → 503.
 *
 * POST /api/shipments
 * Creates a shipment owned by the authenticated user.
 * No/invalid auth → 401.
 * Invalid payload → 400.
 * DB error → 500.
 */

// ─── GET /api/shipments ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let userId: string;

  try {
    const user = await verifyFirebaseToken(req);
    userId = user.uid;
  } catch (err) {
    // verifyFirebaseToken throws a Response on 401 — return it directly
    if (err instanceof Response) return err;
    console.error("[GET /api/shipments] Auth service error:", err);
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  try {
    const db = await getDb();
    const docs = await db
      .collection("shipments")
      .find({ userId })           // ← always scoped to authenticated user
      .sort({ createdAt: -1 })
      .toArray();

    const shipments: Shipment[] = docs.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, userId: _uid, ...rest } = doc;
      // Decrypt sensitive fields before sending to client
      const decrypted = decryptObjectFields(rest, ["notes", "contactDetails", "specialInstructions"]);
      return decrypted as Shipment;
    });

    return NextResponse.json({ shipments, total: shipments.length });
  } catch (err) {
    console.error("[GET /api/shipments] DB error:", err);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 503 }
    );
  }
}

// ─── POST /api/shipments ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let userId: string;

  try {
    const user = await verifyFirebaseToken(req);
    userId = user.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/shipments] Auth service error:", err);
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    origin,
    destination,
    vehicleType,
    cargoType,
    routeId,
    routeName,
    eta,
    distance,
    riskScore,
    riskLevel,
    confidencePercent,
    predictiveAlert,
    riskBreakdown,
  } = raw as unknown as CreateShipmentRequest;

  // Also extract weather/disruption scores for at-risk classification
  const weatherScore    = typeof (raw as Record<string, unknown>).weatherScore    === "number" ? (raw as Record<string, unknown>).weatherScore    as number : riskBreakdown?.weather    ?? 0;
  const disruptionScore = typeof (raw as Record<string, unknown>).disruptionScore === "number" ? (raw as Record<string, unknown>).disruptionScore as number : riskBreakdown?.disruption ?? 0;

  // Validate required string fields
  const missingString = (
    [
      ["origin",      origin],
      ["destination", destination],
      ["vehicleType", vehicleType],
      ["cargoType",   cargoType],
      ["routeId",     routeId],
      ["routeName",   routeName],
      ["eta",         eta],
      ["distance",    distance],
      ["riskLevel",   riskLevel],
    ] as [string, unknown][]
  ).find(([, v]) => !v || typeof v !== "string");

  if (missingString) {
    console.warn(`[POST /api/shipments] Invalid payload — missing field: ${missingString[0]}`);
    return NextResponse.json(
      { error: `Missing or invalid field: ${missingString[0]}` },
      { status: 400 }
    );
  }

  if (typeof riskScore !== "number" || !isFinite(riskScore)) {
    console.warn("[POST /api/shipments] Invalid payload — riskScore not a number");
    return NextResponse.json({ error: "riskScore must be a number" }, { status: 400 });
  }
  if (typeof confidencePercent !== "number" || !isFinite(confidencePercent)) {
    console.warn("[POST /api/shipments] Invalid payload — confidencePercent not a number");
    return NextResponse.json({ error: "confidencePercent must be a number" }, { status: 400 });
  }

  const now = utcNow(); // UTC ISO — clients display in their local timezone

  const selectedRoute =
    routeId.includes("fastest") ? "fastest" as const :
    routeId.includes("safest")  ? "safest"  as const :
    "balanced" as const;

  // At-risk classification:
  //   riskScore >= 60 (default autoFlagThreshold)
  //   OR weatherScore > 70 (severe weather on corridor)
  //   OR disruptionScore > 60 (active disruptions)
  const isAtRisk =
    riskScore >= 60 ||
    weatherScore > 70 ||
    disruptionScore > 60;
  const shipmentStatus: Shipment["status"] = isAtRisk ? "at-risk" : "active";

  const shipment: Shipment = {
    id:                `shp-${Date.now()}`,
    shipmentCode:      generateShipmentCode(),
    origin,
    destination,
    selectedRoute,
    routeName,
    riskScore,
    riskLevel:         getRiskLabel(riskScore),
    eta,
    status:            shipmentStatus,
    lastUpdate:        now,
    cargoType,
    vehicleType,
    distance,
    departureTime:     new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    confidencePercent,
    predictiveAlert:   typeof predictiveAlert === "string" && predictiveAlert
                         ? predictiveAlert
                         : undefined,
    riskBreakdown:     riskBreakdown ?? undefined,
    createdAt:         now,
    updatedAt:         now,
  };

  try {
    const db = await getDb();

    // Strip undefined values — MongoDB rejects documents containing undefined fields
    const cleanBreakdown = shipment.riskBreakdown
      ? Object.fromEntries(Object.entries(shipment.riskBreakdown).filter(([, v]) => v !== undefined))
      : undefined;

    const rawDocument: Record<string, unknown> = Object.fromEntries(
      Object.entries({ ...shipment, riskBreakdown: cleanBreakdown })
        .filter(([, v]) => v !== undefined)
    );

    // Encrypt sensitive fields (notes, contactDetails, specialInstructions)
    // before persisting — non-sensitive operational fields are stored as-is
    const encryptedDocument = encryptObjectFields(rawDocument, ["notes", "contactDetails", "specialInstructions"]);

    // Always scope to authenticated userId — never trust userId from request body
    await db.collection("shipments").insertOne({ ...encryptedDocument, userId });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/shipments] DB insert error:", detail);
    return NextResponse.json({ error: `Failed to save shipment: ${detail}` }, { status: 500 });
  }

  // Emit real-time event to the user's connected clients
  emitToUser(userId, "shipment:created", { shipment });

  return NextResponse.json({ shipment }, { status: 201 });
}
