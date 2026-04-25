import { NextRequest, NextResponse } from "next/server";
import type { Shipment, CreateShipmentRequest } from "@/lib/types";
import { generateShipmentCode, getRiskLabel } from "@/lib/utils";

/**
 * GET /api/shipments
 * POST /api/shipments
 *
 * In-memory storage using a global singleton so the array survives
 * Next.js hot-reloads in dev and is shared with the PATCH route.
 * Resets on full server restart — expected for Layer 1.
 */

// ─── Shared in-memory store ───────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __sentinelShipments: Shipment[] | undefined;
}

if (!global.__sentinelShipments) {
  global.__sentinelShipments = [];
}

const shipments = global.__sentinelShipments;

// ─── GET /api/shipments ───────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ shipments, total: shipments.length });
}

// ─── POST /api/shipments ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let raw: Record<string, unknown>;

  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Extract ONLY the fields defined in CreateShipmentRequest.
  // Extra fields (e.g. urgency from older callers) are silently ignored.
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
  } = raw as CreateShipmentRequest;

  // Validate string fields — must be non-empty strings
  const missingString = [
    ["origin",      origin],
    ["destination", destination],
    ["vehicleType", vehicleType],
    ["cargoType",   cargoType],
    ["routeId",     routeId],
    ["routeName",   routeName],
    ["eta",         eta],
    ["distance",    distance],
    ["riskLevel",   riskLevel],
  ].find(([, v]) => !v || typeof v !== "string");

  if (missingString) {
    return NextResponse.json(
      { error: `Missing or invalid field: ${missingString[0]}` },
      { status: 400 }
    );
  }

  // Validate numeric fields — must be finite numbers
  if (typeof riskScore !== "number" || !isFinite(riskScore)) {
    return NextResponse.json({ error: "riskScore must be a number" }, { status: 400 });
  }
  if (typeof confidencePercent !== "number" || !isFinite(confidencePercent)) {
    return NextResponse.json({ error: "confidencePercent must be a number" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Derive selectedRoute from routeId — never undefined
  const selectedRoute =
    routeId.includes("fastest") ? "fastest" as const :
    routeId.includes("safest")  ? "safest"  as const :
    "balanced" as const;

  // Build COMPLETE Shipment — every required field is explicitly set
  const shipment: Shipment = {
    id:                `shp-${Date.now()}`,
    shipmentCode:      generateShipmentCode(),
    origin,
    destination,
    selectedRoute,
    routeName,
    riskScore,
    riskLevel:         getRiskLabel(riskScore),   // re-derive from score for consistency
    eta,
    status:            "active",
    lastUpdate:        "just now",
    cargoType,
    vehicleType,
    distance,
    departureTime:     new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    confidencePercent,
    predictiveAlert:   typeof predictiveAlert === "string" && predictiveAlert
                         ? predictiveAlert
                         : "Monitoring route conditions",
    createdAt:         now,
    updatedAt:         now,
  };

  shipments.unshift(shipment);

  return NextResponse.json({ shipment }, { status: 201 });
}
