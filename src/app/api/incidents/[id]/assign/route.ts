import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { utcNow } from "@/lib/time";
import type { IncidentTimelineEvent } from "@/lib/types";

/**
 * POST /api/incidents/[id]/assign
 * Assigns an incident to a specific user with SLA deadline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, userRecord, company } = await requireCompany(req);
    const { id: incidentId } = params;
    const body = await req.json();
    const { assignToId, assignToName, slaDurationHours = 4 } = body;

    if (!assignToId) {
      return NextResponse.json({ error: "assignToId is required" }, { status: 400 });
    }

    const db = await getDb();
    const incident = await db.collection("incidents").findOne({
      incidentId,
      companyId: company.companyId,
    });

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    const now = utcNow();
    const slaDeadline = new Date(Date.now() + slaDurationHours * 60 * 60 * 1000).toISOString();

    const timelineEvent: IncidentTimelineEvent = {
      eventType: "assigned",
      timestamp: now,
      actorId: userId,
      actorName: userRecord?.name || userId,
      note: `Assigned to ${assignToName || assignToId}`,
    };

    await db.collection("incidents").updateOne(
      { incidentId, companyId: company.companyId },
      {
        $set: {
          assignedToId: assignToId,
          assignedToName: assignToName || assignToId,
          assignedAt: now,
          slaDeadline,
          slaBreached: false,
          lastUpdated: now,
        },
        $push: { timeline: timelineEvent as any },
      }
    );

    return NextResponse.json({ success: true, assignedToId: assignToId, slaDeadline });
  } catch (error) {
    return handleAuthError(error);
  }
}
