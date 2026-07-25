import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany } from "@/lib/auth-helpers";
import { emitToCompany } from "@/lib/socket-server";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import { RecommendationLifecycleStatus } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(request as any);
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
        newStatus = "accepted";
        updatePayload.resolvedAt = now;
        updatePayload.resolvedBy = auth.userId;
        updatePayload.status = "accepted"; // legacy status
        break;
      case "reject":
        newStatus = "rejected";
        updatePayload.resolvedAt = now;
        updatePayload.resolvedBy = auth.userId;
        updatePayload.status = "rejected"; // legacy status
        break;
      case "execute":
        newStatus = "executed";
        updatePayload.executedAt = now;
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

    // Audit Log
    const auditEvent = `recommendation_${newStatus}` as any;
    await createIntelligenceAudit({
      companyId: auth.companyId,
      eventType: auditEvent,
      source: "CommandCenter",
      userId: auth.userId,
      shipmentId: recommendation.shipmentId,
      metadata: { recommendationId: id, reason, previousStatus: recommendation.lifecycleStatus, newStatus }
    });

    // Timeline Log
    let timelineType = `Recommendation ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    // Make sure we match existing type if possible
    if (action === "accept") timelineType = "Recommendation Accepted";
    if (action === "reject") timelineType = "Recommendation Rejected";

    const timelineEvent = {
      eventId: `te-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shipmentId: recommendation.shipmentId,
      companyId: auth.companyId,
      timestamp: now,
      type: timelineType as any,
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
    console.error("[recommendations transition] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
