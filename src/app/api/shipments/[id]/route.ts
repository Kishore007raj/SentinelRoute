import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * PATCH /api/shipments/[id]
 *
 * Marks a shipment as completed.
 * Only accepts { status: "completed" }.
 * Scoped to the authenticated user — users cannot modify each other's shipments.
 *
 * No/invalid auth → 401.
 * Shipment not found (or belongs to another user) → 404.
 * DB error → 500.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string | null;

  try {
    userId = await getUserIdFromRequest(req);
  } catch {
    console.error("[PATCH /api/shipments/[id]] Auth service error");
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (body.status !== "completed" && body.status !== "at-risk" && body.status !== "active") {
    return NextResponse.json(
      { error: "Invalid status. Allowed values: 'active', 'at-risk', 'completed'." },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();
    const now = new Date().toISOString();

    // Filter by both id AND userId — prevents cross-user modification
    const result = await db.collection("shipments").findOneAndUpdate(
      { id, userId },
      { $set: { status: "completed", lastUpdate: now, updatedAt: now } },
      { returnDocument: "after" }
    );

    if (!result) {
      // Either doesn't exist or belongs to a different user — both are 404
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, userId: _uid, ...shipment } = result;
    return NextResponse.json({ shipment });
  } catch (err) {
    console.error("[PATCH /api/shipments/[id]] DB error:", err);
    return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 });
  }
}
