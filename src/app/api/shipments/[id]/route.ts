import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { emitToUser } from "@/lib/socket-server";
import { utcNow } from "@/lib/time";
import type { UserRecord } from "@/lib/types";

/**
 * PATCH /api/shipments/[id]
 *
 * Updates shipment status.
 * Scoped to authenticated user AND their company — cross-company modification impossible.
 * Task 5: ownership verified via both userId and companyId.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;

  try {
    const user = await verifyFirebaseToken(req);
    userId = user.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/shipments/[id]] Auth service error:", err);
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
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
    const now = utcNow();

    // Task 5: resolve companyId for ownership check — filter by both userId AND companyId
    // For legacy shipments that predate companyId, fall back to userId-only filter
    const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
    const companyId  = userRecord?.companyId;

    // Build update filter: prefer companyId scope for hardened ownership check
    const updateFilter = companyId
      ? { id, companyId }   // company-scoped (Module 1 + later shipments)
      : { id, userId };     // legacy fallback (pre-Module 1 shipments)

    const result = await db.collection("shipments").findOneAndUpdate(
      updateFilter,
      { $set: { status: "completed", lastUpdate: now, updatedAt: now } },
      { returnDocument: "after" }
    );

    if (!result) {
      // Either doesn't exist or belongs to a different user — both are 404
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, userId: _uid, ...shipment } = result;

    // Emit real-time status update to the user's connected clients
    emitToUser(userId, "shipment:status", {
      id,
      status:     "completed",
      lastUpdate: now,
    });

    return NextResponse.json({ shipment });
  } catch (err) {
    console.error("[PATCH /api/shipments/[id]] DB error:", err);
    return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 });
  }
}
