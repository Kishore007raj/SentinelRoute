import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { createAuditEvent } from "@/lib/audit";
import { addTimelineEvent } from "@/lib/timeline-service";
import { utcNow } from "@/lib/time";
import { ShipmentCheckpoint, TimelineEventType } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedCompany(req);
    const { id: shipmentId } = await params;

    if (!shipmentId) {
      return NextResponse.json({ error: "Missing shipment ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { checkpointId, action, notes } = body; // action: arrive, depart, skip

    if (!checkpointId || !["arrive", "depart", "skip"].includes(action)) {
      return NextResponse.json({ error: "Invalid checkpointId or action" }, { status: 400 });
    }

    const db = await getDb();

    const execution = await db.collection("shipment_executions").findOne({
      shipmentId,
      companyId: auth.company.companyId,
    });

    if (!execution || execution.status !== "driving") {
      return NextResponse.json(
        { error: "Execution not found or not currently driving" },
        { status: 400 }
      );
    }

    const checkpointIndex = execution.checkpoints.findIndex(
      (cp: ShipmentCheckpoint) => cp.id === checkpointId
    );
    if (checkpointIndex === -1) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }

    const checkpoint = execution.checkpoints[checkpointIndex];
    const now = utcNow();

    // ── arrive ───────────────────────────────────────────────────────────────
    if (action === "arrive") {
      if (checkpoint.status !== "pending") {
        return NextResponse.json({ error: "Checkpoint is not pending" }, { status: 400 });
      }

      // The $elemMatch filter requires both id AND status to match atomically.
      // If a concurrent request already set status="arrived", the filter finds
      // no document and modifiedCount=0, returning 409. This eliminates the
      // race condition where two concurrent arrivals both succeed and the second
      // one overwrites the first arrivalTime.
      const updateResult = await db.collection("shipment_executions").updateOne(
        {
          shipmentId,
          companyId: auth.company.companyId,
          checkpoints: { $elemMatch: { id: checkpointId, status: "pending" } },
        },
        {
          $set: {
            "checkpoints.$.status": "arrived",
            "checkpoints.$.arrivalTime": now,
            currentCheckpoint: checkpointId,
            lastUpdated: now,
          },
        }
      );

      if (updateResult.modifiedCount === 0) {
        return NextResponse.json(
          { error: "Failed to update checkpoint — it may have already been updated by a concurrent request" },
          { status: 409 }
        );
      }

      const updatedCheckpoint = { ...checkpoint, status: "arrived", arrivalTime: now };

      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Checkpoint Arrived",
        `Arrived at checkpoint: ${checkpoint.name}`,
        "system",
        100
      );

      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "checkpoint_arrived",
        performedBy: auth.userId,
        details: { shipmentId, checkpointId, notes },
      });

      return NextResponse.json({ success: true, checkpoint: updatedCheckpoint });
    }

    // ── depart ───────────────────────────────────────────────────────────────
    if (action === "depart") {
      if (checkpoint.status !== "arrived") {
        return NextResponse.json(
          { error: "Must arrive at checkpoint before departing" },
          { status: 400 }
        );
      }

      // The $elemMatch filter requires both id AND status to match atomically,
      // preventing a concurrent depart from matching after the first already fired.
      // $inc is used for the counters instead of pre-read absolute values so that
      // concurrent departures on different checkpoints of the same execution do not
      // overwrite each other's increments (TOCTOU counter drift).
      const updateResult = await db.collection("shipment_executions").updateOne(
        {
          shipmentId,
          companyId: auth.company.companyId,
          checkpoints: { $elemMatch: { id: checkpointId, status: "arrived" } },
        },
        {
          $set: {
            "checkpoints.$.status": "departed",
            "checkpoints.$.departureTime": now,
            currentCheckpoint: null,
            lastUpdated: now,
          },
          $inc: {
            completedCheckpoints: 1,
            remainingCheckpoints: -1,
          },
        }
      );

      if (updateResult.modifiedCount === 0) {
        return NextResponse.json(
          { error: "Failed to update checkpoint — it may have already been updated by a concurrent request" },
          { status: 409 }
        );
      }

      const updatedCheckpoint = { ...checkpoint, status: "departed", departureTime: now };

      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Checkpoint Departed",
        `Departed from checkpoint: ${checkpoint.name}`,
        "system",
        100
      );

      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "checkpoint_departed",
        performedBy: auth.userId,
        details: { shipmentId, checkpointId, notes },
      });

      return NextResponse.json({ success: true, checkpoint: updatedCheckpoint });
    }

    // ── skip ─────────────────────────────────────────────────────────────────
    if (action === "skip") {
      if (checkpoint.status !== "pending") {
        return NextResponse.json({ error: "Can only skip pending checkpoints" }, { status: 400 });
      }

      // $elemMatch with status guard prevents a concurrent skip from matching
      // after the first already changed the status away from "pending".
      // $inc avoids the stale-read counter drift present in the old absolute-value $set.
      const updateResult = await db.collection("shipment_executions").updateOne(
        {
          shipmentId,
          companyId: auth.company.companyId,
          checkpoints: { $elemMatch: { id: checkpointId, status: "pending" } },
        },
        {
          $set: {
            "checkpoints.$.status": "skipped",
            lastUpdated: now,
          },
          $inc: {
            remainingCheckpoints: -1,
          },
        }
      );

      if (updateResult.modifiedCount === 0) {
        return NextResponse.json(
          { error: "Failed to update checkpoint — it may have already been updated by a concurrent request" },
          { status: 409 }
        );
      }

      const updatedCheckpoint = { ...checkpoint, status: "skipped" };

      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "System Alert",
        `Checkpoint skipped: ${checkpoint.name}`,
        "system",
        100
      );

      return NextResponse.json({ success: true, checkpoint: updatedCheckpoint });
    }

    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  } catch (err) {
    return handleAuthError(err);
  }
}
