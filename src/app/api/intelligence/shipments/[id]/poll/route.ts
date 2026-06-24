import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { calculateRoutePrediction } from "@/lib/prediction-engine";
import { evaluateAlerts } from "@/lib/alert-service";
import { addTimelineEvent } from "@/lib/timeline-service";
import { Shipment } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { company } = await requireCompany(req as any);
    const companyId = company.companyId;
    const { id } = await params;

    const db = await getDb();
    
    const shipmentDoc = await db.collection("shipments").findOne({ 
      id, companyId
    });

    if (!shipmentDoc) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const shipment = shipmentDoc as unknown as Shipment;

    if (shipment.status !== "active" && shipment.status !== "at-risk") {
      return NextResponse.json({ message: "Shipment is not active, polling skipped", shipment });
    }

    // Recalculate prediction
    const prediction = await calculateRoutePrediction(shipment);

    // Evaluate alerts
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
    } else {
      // Just a regular monitoring ping event every few cycles could be logged, but we'll keep it quiet unless status changes
      // Or we can log a "Risk Updated" if the trend changed significantly.
      // We will skip flooding the timeline.
    }

    // Update shipment Risk and ETA Confidence if changed drastically (e.g., status flip to at-risk)
    if (prediction.overallOperationalConfidence < 50 && shipment.status !== "at-risk") {
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
    } else if (prediction.overallOperationalConfidence >= 80 && shipment.status === "at-risk") {
      await db.collection("shipments").updateOne(
        { id: shipment.id },
        { $set: { status: "active", riskLevel: "medium" } } // or 'low' depending on logic
      );
      await addTimelineEvent(
        shipment.id,
        shipment.companyId || companyId,
        "Risk Reduced",
        "Shipment status restored to active. Conditions improved.",
        "Prediction Engine",
        prediction.overallOperationalConfidence
      );
    }

    return NextResponse.json({ success: true, prediction, alert });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(`[POST /api/intelligence/shipments/[id]/poll]`, err);
    return NextResponse.json({ error: "Failed to process polling" }, { status: 500 });
  }
}
