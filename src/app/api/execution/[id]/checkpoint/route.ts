import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { createAuditEvent } from "@/lib/audit";
import { addTimelineEvent } from "@/lib/timeline-service";
import { utcNow } from "@/lib/time";
import { ShipmentCheckpoint } from "@/lib/types";

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
      companyId: auth.company.companyId
    });
    
    if (!execution || execution.status !== "driving") {
      return NextResponse.json({ error: "Execution not found or not currently driving" }, { status: 400 });
    }
    
    const checkpointIndex = execution.checkpoints.findIndex((cp: ShipmentCheckpoint) => cp.id === checkpointId);
    if (checkpointIndex === -1) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }
    
    const checkpoint = execution.checkpoints[checkpointIndex];
    const now = utcNow();
    
    if (action === "arrive") {
      if (checkpoint.status !== "pending") {
        return NextResponse.json({ error: "Checkpoint is not pending" }, { status: 400 });
      }
      
      const updatedCheckpoints = [...execution.checkpoints];
      updatedCheckpoints[checkpointIndex] = {
        ...checkpoint,
        status: "arrived",
        arrivalTime: now
      };
      
      await db.collection("shipment_executions").updateOne(
        { shipmentId },
        { 
          $set: { 
            checkpoints: updatedCheckpoints,
            currentCheckpoint: checkpointId,
            lastUpdated: now
          }
        }
      );
      
      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Checkpoint Arrived" as any,
        `Arrived at checkpoint: ${checkpoint.name}`,
        "system",
        100
      );
      
      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "checkpoint_arrived",
        performedBy: auth.userId,
        details: { shipmentId, checkpointId, notes }
      });
      
      return NextResponse.json({ success: true, checkpoint: updatedCheckpoints[checkpointIndex] });
    }
    
    if (action === "depart") {
      if (checkpoint.status !== "arrived") {
        return NextResponse.json({ error: "Must arrive at checkpoint before departing" }, { status: 400 });
      }
      
      const updatedCheckpoints = [...execution.checkpoints];
      updatedCheckpoints[checkpointIndex] = {
        ...checkpoint,
        status: "departed",
        departureTime: now
      };
      
      const completedCount = execution.completedCheckpoints + 1;
      const remainingCount = execution.remainingCheckpoints - 1;
      
      await db.collection("shipment_executions").updateOne(
        { shipmentId },
        { 
          $set: { 
            checkpoints: updatedCheckpoints,
            currentCheckpoint: null,
            completedCheckpoints: completedCount,
            remainingCheckpoints: remainingCount < 0 ? 0 : remainingCount,
            lastUpdated: now
          }
        }
      );
      
      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Checkpoint Departed" as any,
        `Departed from checkpoint: ${checkpoint.name}`,
        "system",
        100
      );
      
      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "checkpoint_departed",
        performedBy: auth.userId,
        details: { shipmentId, checkpointId, notes }
      });
      
      return NextResponse.json({ success: true, checkpoint: updatedCheckpoints[checkpointIndex] });
    }
    
    if (action === "skip") {
      if (checkpoint.status !== "pending") {
        return NextResponse.json({ error: "Can only skip pending checkpoints" }, { status: 400 });
      }
      
      const updatedCheckpoints = [...execution.checkpoints];
      updatedCheckpoints[checkpointIndex] = {
        ...checkpoint,
        status: "skipped"
      };
      
      const remainingCount = execution.remainingCheckpoints - 1;
      
      await db.collection("shipment_executions").updateOne(
        { shipmentId },
        { 
          $set: { 
            checkpoints: updatedCheckpoints,
            remainingCheckpoints: remainingCount < 0 ? 0 : remainingCount,
            lastUpdated: now
          }
        }
      );
      
      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "System Alert" as any,
        `Checkpoint skipped: ${checkpoint.name}`,
        "system",
        100
      );
      
      return NextResponse.json({ success: true, checkpoint: updatedCheckpoints[checkpointIndex] });
    }
    
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  } catch (err) {
    return handleAuthError(err);
  }
}
