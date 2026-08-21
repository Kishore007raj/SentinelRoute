import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireWorkforceRead, handleAuthError } from "@/lib/auth-helpers";

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

    // Parallelize all 3 queries instead of sequential fetches
    const [recommendations, recentIncidents, timelineEvents] = await Promise.all([
      // 1. Fetch pending recommendations
      db.collection("operational_recommendations")
        .find({ companyId, status: "pending" })
        .sort({ confidence: -1 })
        .limit(10)
        .toArray(),

      // 2. Fetch recent alerts (incidents in area or system alerts)
      db.collection("incidents")
        .find({ $or: [{ companyId }, { companyId: { $exists: false } }, { companyId: null }] })
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray(),

      // 3. Fetch recent timeline events marked for operational feed
      db.collection("timeline_events")
        .find({ 
          companyId, 
          type: { 
            $in: [
              "Shipment Created", "Shipment Assigned", "Driver Assigned", "Vehicle Assigned", 
              "Vehicle Maintenance", "Driver Suspension", "Incident Reported", "Route Changed", 
              "Risk Increased", "Risk Decreased", "Recommendation Generated", 
              "Recommendation Accepted", "Shipment Completed", "Shipment Cancelled"
            ] 
          } 
        })
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray(),
    ]);

    return NextResponse.json({
      data: {
        recommendations,
        alerts: recentIncidents,
        events: timelineEvents
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Operational Feed Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch operational feed" }, { status: 500 });
  }
}
