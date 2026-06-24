import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { calculateRoutePrediction } from "@/lib/prediction-engine";
import { evaluateAlerts } from "@/lib/alert-service";
import { addTimelineEvent } from "@/lib/timeline-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import { Shipment } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(req as any);
    const companyId = company.companyId;
    const isSuperAdmin = userRecord.role === "super_admin";
    const { id } = await params;

    // ── Super admin cross-company read audit ────────────────────────────────
    if (isSuperAdmin) {
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "PollRoute",
        metadata: {
          companyIdViewed: companyId,
          endpoint:        `/api/intelligence/shipments/${id}/poll`,
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    }

    const db = await getDb();

    const shipmentDoc = await db.collection("shipments").findOne({ id, companyId });
    if (!shipmentDoc) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const shipment = shipmentDoc as unknown as Shipment;

    if (shipment.status !== "active" && shipment.status !== "at-risk") {
      return NextResponse.json({ message: "Shipment is not active, polling skipped", shipment });
    }

    const previousStatus = shipment.status;

    // Recalculate prediction (audit events emitted inside calculateRoutePrediction)
    const prediction = await calculateRoutePrediction(shipment);

    // ── Audit: risk_calculated ───────────────────────────────────────────────
    createIntelligenceAudit({
      companyId,
      shipmentId: shipment.id,
      userId:     userRecord.userId,
      eventType:  "risk_calculated",
      source:     "PollRoute",
      metadata: {
        predictionId:              prediction.predictionId,
        overallOperationalConfidence: prediction.overallOperationalConfidence,
        riskTrend:                 prediction.riskTrend,
        delayProbability:          prediction.delayProbability,
        disruptionProbability:     prediction.disruptionProbability,
        contributingFactors:       prediction.contributingFactors,
      },
    }).catch(() => {});

    // Evaluate alerts (audit emitted inside evaluateAlerts)
    const alert = await evaluateAlerts(shipment, prediction);

    // Log to timeline if there was an alert
    if (alert) {
      await addTimelineEvent(
        shipment.id,
        shipment.companyId || companyId,
        "System Alert",
        alert.reason + ": " + alert.recommendedAction,
        "SentinelRoute Intelligence",
        alert.confidence,
        ["delayProbability", "disruptionProbability"]
      );
    }

    // ── Status flip: active → at-risk ────────────────────────────────────────
    if (prediction.overallOperationalConfidence < 50 && previousStatus !== "at-risk") {
      await db.collection("shipments").updateOne(
        { id: shipment.id },
        { $set: { status: "at-risk", riskLevel: "high" } }
      );

      await addTimelineEvent(
        shipment.id,
        shipment.companyId || companyId,
        "Risk Increased",
        "Shipment status automatically changed to at-risk due to operational confidence drop.",
        "Prediction Engine",
        prediction.overallOperationalConfidence
      );

      // ── Audit: risk_increased ──────────────────────────────────────────────
      createIntelligenceAudit({
        companyId,
        shipmentId: shipment.id,
        userId:     userRecord.userId,
        eventType:  "risk_increased",
        source:     "PollRoute",
        metadata: {
          previousStatus,
          newStatus:                 "at-risk",
          overallOperationalConfidence: prediction.overallOperationalConfidence,
          predictionId:              prediction.predictionId,
        },
      }).catch(() => {});
    }

    // ── Status flip: at-risk → active ────────────────────────────────────────
    else if (prediction.overallOperationalConfidence >= 80 && previousStatus === "at-risk") {
      await db.collection("shipments").updateOne(
        { id: shipment.id },
        { $set: { status: "active", riskLevel: "medium" } }
      );

      await addTimelineEvent(
        shipment.id,
        shipment.companyId || companyId,
        "Risk Reduced",
        "Shipment status restored to active. Conditions improved.",
        "Prediction Engine",
        prediction.overallOperationalConfidence
      );

      // ── Audit: risk_decreased ─────────────────────────────────────────────
      createIntelligenceAudit({
        companyId,
        shipmentId: shipment.id,
        userId:     userRecord.userId,
        eventType:  "risk_decreased",
        source:     "PollRoute",
        metadata: {
          previousStatus,
          newStatus:                 "active",
          overallOperationalConfidence: prediction.overallOperationalConfidence,
          predictionId:              prediction.predictionId,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, prediction, alert });
  } catch (err: any) {
    if (err instanceof Response) {
      return new NextResponse(err.body, { status: err.status, headers: { "Content-Type": "application/json" } });
    }
    console.error(`[POST /api/intelligence/shipments/[id]/poll]`, err);
    return NextResponse.json({ error: "Failed to process polling" }, { status: 500 });
  }
}
