import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { utcNow } from "@/lib/time";
import type { IncidentTimelineEvent } from "@/lib/types";

/**
 * GET /api/cron/sla-check
 * Cron route that checks for incidents that have breached their SLA deadline.
 * Should be called by Vercel Cron every 15 minutes.
 */
export async function GET(req: NextRequest) {
  // Basic security: only allow internal cron calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const now = utcNow();

    // Find all incidents with a slaDeadline that has passed and have not been breached/resolved yet
    const breachedIncidents = await db.collection("incidents").find({
      slaDeadline: { $lt: now },
      slaBreached: { $ne: true },
      commandStatus: { $nin: ["resolved"] },
    }).toArray();

    let count = 0;
    for (const incident of breachedIncidents) {
      const timelineEvent: IncidentTimelineEvent = {
        eventType: "escalated",
        timestamp: now,
        note: "SLA deadline breached — auto-escalated by system",
      };

      await db.collection("incidents").updateOne(
        { incidentId: incident.incidentId },
        {
          $set: {
            slaBreached: true,
            escalationLevel: (incident.escalationLevel ?? 0) + 1,
            lastUpdated: now,
          },
          $push: { timeline: timelineEvent as any },
        }
      );
      count++;
    }

    return NextResponse.json({
      success: true,
      breachedCount: count,
      checkedAt: now,
    });
  } catch (error: any) {
    console.error("[sla-check cron] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
