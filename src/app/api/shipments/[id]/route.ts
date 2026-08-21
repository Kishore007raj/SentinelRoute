import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { utcNow } from "@/lib/time";
import type { UserRecord } from "@/lib/types";
import { addTimelineEvent } from "@/lib/timeline-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";

/**
 * GET /api/shipments/[id]
 * Returns a single shipment by ID, scoped to the authenticated user's company.
 *
 * PATCH /api/shipments/[id]
 * Updates shipment status.
 * Scoped to authenticated user AND their company - cross-company modification impossible.
 */

// ─── GET /api/shipments/[id] ──────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;

  try {
    const user = await verifyFirebaseToken(req);
    userId = user.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/shipments/[id]] Auth service error:", err);
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing shipment id" }, { status: 400 });
  }

  try {
    const db = await getDb();

    const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
    const companyId  = userRecord?.companyId;
    const isSuperAdmin = userRecord?.role === "super_admin";

    // Super admin: allow ?companyId= cross-company reads
    const url = new URL(req.url);
    const targetCompanyId = url.searchParams.get("companyId");
    const queryCompanyId = isSuperAdmin && targetCompanyId ? targetCompanyId : companyId;

    const query = queryCompanyId
      ? { id, companyId: queryCompanyId }
      : { id, userId };

    const doc = await db.collection("shipments").findOne(query);

    if (!doc) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Super admin cross-company read audit
    if (isSuperAdmin && targetCompanyId) {
      createIntelligenceAudit({
        companyId: queryCompanyId!,
        userId,
        eventType: "super_admin_read",
        source:    "ShipmentDetailRoute",
        metadata:  { shipmentId: id, companyIdViewed: queryCompanyId },
      }).catch(() => {});
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, userId: _uid, ...shipment } = doc;
    return NextResponse.json({ shipment });
  } catch (err) {
    console.error("[GET /api/shipments/[id]] DB error:", err);
    return NextResponse.json({ error: "Failed to fetch shipment" }, { status: 500 });
  }
}

// ─── PATCH /api/shipments/[id] ────────────────────────────────────────────────

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

  let body: { status?: unknown; cancellationReason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ALLOWED_STATUSES = ["active", "at-risk", "completed", "cancelled", "draft"] as const;
  if (!ALLOWED_STATUSES.includes(body.status as typeof ALLOWED_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}.` },
      { status: 400 }
    );
  }

  const newStatus = body.status as typeof ALLOWED_STATUSES[number];

  try {
    const db = await getDb();
    const now = utcNow();

    const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
    const companyId  = userRecord?.companyId;
    const isSuperAdmin = userRecord?.role === "super_admin";

    const url = new URL(req.url);
    const targetCompanyId = url.searchParams.get("companyId");

    // Bug #6 fix: super admin may not mutate any company's shipment status
    if (isSuperAdmin && targetCompanyId) {
      return NextResponse.json(
        { error: "Super Admin may not modify shipment status." },
        { status: 403 }
      );
    }

    const updateFilter = companyId
      ? { id, companyId }
      : { id, userId };

    const updateFields: Record<string, unknown> = {
      status:     newStatus,
      lastUpdate: now,
      updatedAt:  now,
    };

    // For cancellation, store reason
    if (newStatus === "cancelled" && typeof body.cancellationReason === "string") {
      updateFields.cancellationReason = body.cancellationReason;
    }

    // For completion, always use "completed" value
    if (newStatus === "completed") {
      updateFields.status = "completed";
    }

    const result = await db.collection("shipments").findOneAndUpdate(
      updateFilter,
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, userId: _uid, ...shipment } = result;


    const shipmentCompanyIdForTimeline = (result.companyId as string) ?? companyId ?? "";
    if (newStatus === "completed") {
      addTimelineEvent(
        id, shipmentCompanyIdForTimeline, "Shipment Completed",
        "Shipment marked as completed.",
        "SentinelRoute", 100, ["status"]
      ).catch(() => {});
      createIntelligenceAudit({
        companyId: shipmentCompanyIdForTimeline, shipmentId: id, userId,
        eventType: "risk_calculated", source: "ShipmentStatusUpdate",
        metadata: { shipmentId: id, newStatus, action: "shipment_completed" },
      }).catch(() => {});
    } else if (newStatus === "cancelled") {
      addTimelineEvent(
        id, shipmentCompanyIdForTimeline, "Shipment Cancelled",
        `Shipment cancelled. Reason: ${typeof body.cancellationReason === "string" ? body.cancellationReason : "Not specified"}.`,
        "SentinelRoute", 100, ["status"]
      ).catch(() => {});
      createIntelligenceAudit({
        companyId: shipmentCompanyIdForTimeline, shipmentId: id, userId,
        eventType: "alert_created", source: "ShipmentStatusUpdate",
        metadata: { shipmentId: id, newStatus, reason: body.cancellationReason, action: "shipment_cancelled" },
      }).catch(() => {});
    }


    return NextResponse.json({ shipment });
  } catch (err) {
    console.error("[PATCH /api/shipments/[id]] DB error:", err);
    return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 });
  }
}
