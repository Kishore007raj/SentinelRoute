import { NextRequest, NextResponse } from "next/server";
import type { Shipment } from "@/lib/types";

/**
 * PATCH /api/shipments/[id]
 *
 * Marks a shipment as completed.
 * Only accepts status === "completed" — no other status transitions
 * are permitted through this endpoint.
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

// ─── PATCH /api/shipments/[id] ────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing shipment id" }, { status: 400 });
  }

  let body: { status: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only "completed" is a valid status transition through this endpoint
  if (body.status !== "completed") {
    return NextResponse.json(
      { error: "Invalid status update. Only 'completed' is accepted." },
      { status: 400 }
    );
  }

  const idx = shipments.findIndex((s) => s.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  // Update ONLY status and updatedAt — nothing else
  shipments[idx] = {
    ...shipments[idx],
    status:     "completed",
    lastUpdate: "just now",
    updatedAt:  new Date().toISOString(),
  };

  return NextResponse.json({ shipment: shipments[idx] });
}
