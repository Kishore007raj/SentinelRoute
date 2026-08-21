import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { emitToCompany } from "@/lib/socket-server";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import { RecommendationLifecycleStatus, TimelineEventType } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(request);
    const auth = {
      companyId: company.companyId,
      userId: userRecord.userId,
      role: userRecord.role
    };

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const db = await getDb();
    const recommendation = await db.collection("operational_recommendations").findOne({
      recommendationId: id,
      companyId: auth.companyId,
    });

    if (!recommendation) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    // RBAC logic example (could be more advanced based on recommendation severity)
    const role = auth.role;
    if (action === "override" && role === "dispatcher") {
       return NextResponse.json({ error: "Dispatchers cannot override system recommendations. Escalate to Operations Manager." }, { status: 403 });
    }

    let newStatus: RecommendationLifecycleStatus;
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {};

    switch (action) {
      case "view":
        newStatus = "viewed";
        updatePayload.viewedAt = now;
        updatePayload.viewedBy = auth.userId;
        break;
      case "assign":
        newStatus = "assigned";
        updatePayload.assignedAt = now;
        updatePayload.assignedTo = auth.userId;
        break;
      case "approve":
      case "accept":
      case "execute":
        // ── Multi-Step Approval Chain Logic ─────────────────────────────────
        if (recommendation.approvalChain && Array.isArray(recommendation.approvalChain) && recommendation.approvalChain.length > 0) {
          const chain = [...recommendation.approvalChain];
          const currentStepIdx = (recommendation.currentApprovalStep || 1) - 1;
          const currentStep = chain[currentStepIdx];

          if (currentStep) {
            currentStep.status = "approved";
            currentStep.approverId = auth.userId;
            currentStep.approverName = userRecord.name || auth.userId;
            currentStep.actedAt = now;
            currentStep.notes = reason || "Approved";

            updatePayload.approvalChain = chain;

            // If more steps remain in chain, advance step and don't execute yet
            if (currentStepIdx + 1 < chain.length) {
              updatePayload.currentApprovalStep = currentStepIdx + 2;
              newStatus = "viewed";
              break;
            }
          }
        }

        if (action === "execute") {
          newStatus = "executed";
          updatePayload.executedAt = now;
        } else {
          newStatus = "accepted";
          updatePayload.resolvedAt = now;
          updatePayload.resolvedBy = auth.userId;
          updatePayload.status = "accepted"; // legacy status
        }
        
        // ── ACTUAL OPERATIONAL EXECUTION ──────────────────────────────────────
        if (recommendation.shipmentId) {
          const shipmentUpdate: Record<string, any> = { updatedAt: now };
          let shouldUpdateShipment = false;

          switch (recommendation.type) {
            case "Reassign Driver":
              shipmentUpdate.userId = null; // Unassign current driver
              shouldUpdateShipment = true;
              break;
            case "Change Route":
              shipmentUpdate.selectedRoute = "Safe Route";
              shipmentUpdate.riskLevel = "low";
              shouldUpdateShipment = true;
              break;
            case "Pause Shipment":
            case "Delay Dispatch":
              shipmentUpdate.status = "draft";
              shouldUpdateShipment = true;
              break;
            case "Replace Vehicle":
              shipmentUpdate.vehicleId = null;
              shouldUpdateShipment = true;
              break;
          }

          if (shouldUpdateShipment) {
            await db.collection("shipments").updateOne(
              { id: recommendation.shipmentId, companyId: auth.companyId },
              { $set: shipmentUpdate }
            );
            emitToCompany(auth.companyId, "shipment:updated", {
              id: recommendation.shipmentId,
              ...shipmentUpdate
            });
          }
        }
        break;
      case "reject":
        newStatus = "rejected";
        updatePayload.resolvedAt = now;
        updatePayload.resolvedBy = auth.userId;
        updatePayload.status = "rejected"; // legacy status
        break;
      case "complete":
        newStatus = "completed";
        updatePayload.completedAt = now;
        break;
      case "override":
        newStatus = "rejected"; // Effectively rejecting the AI
        updatePayload.resolvedAt = now;
        updatePayload.resolvedBy = auth.userId;
        updatePayload.status = "rejected"; // legacy status
        break;
      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    updatePayload.lifecycleStatus = newStatus;

    await db.collection("operational_recommendations").updateOne(
      { recommendationId: id, companyId: auth.companyId },
      { $set: updatePayload }
    );

    // Audit Log - eventType is a free-form string for audit records
    const auditEvent = `recommendation_${newStatus}` as any;
    await createIntelligenceAudit({
      companyId: auth.companyId,
      eventType: auditEvent,
      source: "CommandCenter",
      userId: auth.userId,
      shipmentId: recommendation.shipmentId,
      metadata: { recommendationId: id, reason, previousStatus: recommendation.lifecycleStatus, newStatus }
    });

    // Timeline Log - build a matching TimelineEventType string
    let timelineType: TimelineEventType = "Recommendation Generated";
    if (action === "accept" || action === "approve") timelineType = "Recommendation Accepted";
    else if (action === "reject") timelineType = "Recommendation Rejected";
    else if (action === "execute") timelineType = "Recommendation Executed";
    else if (action === "complete") timelineType = "Recommendation Completed";
    else if (action === "assign") timelineType = "Recommendation Assigned";
    else if (action === "view") timelineType = "Recommendation Viewed";
    else if (action === "override") timelineType = "Recommendation Overridden";

    const timelineEvent = {
      eventId: `te-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shipmentId: recommendation.shipmentId,
      companyId: auth.companyId,
      timestamp: now,
      type: timelineType,
      description: `Recommendation '${recommendation.type}' was ${newStatus} by ${role}. ${reason ? "Reason: " + reason : ""}`,
      source: "Command Center",
      confidence: 100,
    };
    await db.collection("shipment_timelines").insertOne(timelineEvent);

    emitToCompany(auth.companyId, "feed:updated", {
      type: "recommendation",
      id,
      status: newStatus,
      timestamp: now
    });
    
    // Refresh recommendations global feed
    emitToCompany(auth.companyId, "sync:refresh_feed", {});

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    return handleAuthError(error);
  }
}
