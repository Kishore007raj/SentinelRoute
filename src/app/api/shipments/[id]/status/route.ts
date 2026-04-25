import { NextRequest, NextResponse } from "next/server";
import { updateShipmentStatus } from "@/lib/firestore";
import type { ShipmentStatus } from "@/lib/types";

/**
 * PATCH /api/shipments/[id]/status
 * Updates the status of a shipment in Firestore.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing shipment id" }, { status: 400 });
  }

  let body: { status: ShipmentStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validStatuses: ShipmentStatus[] = ["pending", "active", "at-risk", "completed"];
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  try {
    await updateShipmentStatus(id, body.status);
    return NextResponse.json({ success: true, id, status: body.status });
  } catch (err) {
    console.error("[PATCH /api/shipments/[id]/status]", err);
    return NextResponse.json({ error: "Failed to update shipment status" }, { status: 500 });
  }
}
