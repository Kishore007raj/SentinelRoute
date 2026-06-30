import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireWorkforceRead, handleAuthError } from "@/lib/auth-helpers";
import { OperationalHealthScore } from "@/lib/types";

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireWorkforceRead>>;
  try {
    auth = await requireWorkforceRead(req);
  } catch (err) {
    return handleAuthError(err);
  }
  const { companyId } = auth;
  try {
    const db = await getDb();

    // Fetch the latest health score for the company
    const healthScoreDoc = await db.collection("operational_metrics").findOne(
      { companyId },
      { sort: { calculatedAt: -1 } }
    );

    let currentScore: OperationalHealthScore;

    if (!healthScoreDoc) {
      // If no score exists yet, return a default good score
      currentScore = {
        companyId,
        score: 95,
        status: "Good",
        activeShipments: 0,
        averageRisk: 5,
        driverAvailability: 100,
        vehicleAvailability: 100,
        incidentDensity: 0,
        routeConfidence: 100,
        delayedShipments: 0,
        complianceScore: 100,
        calculatedAt: new Date().toISOString()
      };
    } else {
      currentScore = healthScoreDoc as unknown as OperationalHealthScore;
    }

    return NextResponse.json({ data: currentScore }, { status: 200 });

  } catch (error) {
    console.error("Operational Health Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch operational health" }, { status: 500 });
  }
}
