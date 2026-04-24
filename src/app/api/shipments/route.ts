import { NextRequest, NextResponse } from "next/server";
import type { CreateShipmentRequest } from "@/lib/types";
import { generateShipmentCode, getRiskLabel } from "@/lib/utils";
import { createShipmentDoc, getShipmentsByUser } from "@/lib/firestore";

/**
 * Extracts the userId from the Authorization header.
 *
 * The client sends: Authorization: Bearer <firebase-uid>
 *
 * Note: In a production system you would verify a Firebase ID token here.
 * For this layer we trust the UID sent by the authenticated client since
 * all routes are already protected by middleware + client auth guard.
 * Full token verification will be added when firebase-admin is introduced.
 */
function getUserId(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const uid = auth.replace("Bearer ", "").trim();
  return uid || null;
}

// ─── GET /api/shipments ───────────────────────────────────────────────────────

/**
 * Returns all shipments for the authenticated user from Firestore.
 * Requires: Authorization: Bearer <uid>
 */
export async function GET(req: NextRequest) {
  const userId = getUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const shipments = await getShipmentsByUser(userId);
    return NextResponse.json({ shipments, total: shipments.length });
  } catch (err) {
    console.error("[GET /api/shipments]", err);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 500 }
    );
  }
}

// ─── POST /api/shipments ──────────────────────────────────────────────────────

/**
 * Creates a new shipment in Firestore for the authenticated user.
 * Requires: Authorization: Bearer <uid>
 * Body: CreateShipmentRequest
 */
export async function POST(req: NextRequest) {
  const userId = getUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateShipmentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  const required: (keyof CreateShipmentRequest)[] = [
    "origin", "destination", "vehicleType", "cargoType",
    "urgency", "routeId", "routeName", "riskScore",
    "riskLevel", "eta", "distance", "confidencePercent",
  ];

  for (const field of required) {
    if (body[field] === undefined || body[field] === "") {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const now = new Date();

  const shipmentData = {
    shipmentCode:   generateShipmentCode(),
    origin:         body.origin,
    destination:    body.destination,
    selectedRoute:  body.routeId.includes("fastest")
                      ? "fastest" as const
                      : body.routeId.includes("safest")
                        ? "safest" as const
                        : "balanced" as const,
    routeName:      body.routeName,
    riskScore:      body.riskScore,
    riskLevel:      getRiskLabel(body.riskScore),
    eta:            body.eta,
    status:         "active" as const,
    lastUpdate:     "just now",
    cargoType:      body.cargoType,
    vehicleType:    body.vehicleType,
    distance:       body.distance,
    departureTime:  now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    confidencePercent: body.confidencePercent,
    predictiveAlert: body.predictiveAlert,
    userId,
    createdAt:      now.toISOString(),
  };

  try {
    const firestoreId = await createShipmentDoc(shipmentData, userId);

    const shipment = { id: firestoreId, ...shipmentData };
    return NextResponse.json({ shipment }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/shipments]", err);
    return NextResponse.json(
      { error: "Failed to create shipment" },
      { status: 500 }
    );
  }
}
