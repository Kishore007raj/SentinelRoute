import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { utcNow } from "@/lib/time";
import type { IncidentTimelineEvent } from "@/lib/types";

/**
 * POST /api/incidents/[id]/escalate
 * Escalates an incident, increasing its escalation level and adding a timeline note.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, userRecord, company } = await requireCompany(req);
    const { id: incidentId } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason = "Manually escalated" } = body;

    const db = await getDb();
    const incident = await db.collection("incidents").findOne({
      incidentId,
      companyId: company.companyId,
    });

    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    const now = utcNow();
    const currentLevel = incident.escalationLevel ?? 0;
    const newLevel = Math.min(currentLevel + 1, 3); // max level 3

    const timelineEvent: IncidentTimelineEvent = {
      eventType: "escalated",
      timestamp: now,
      actorId: userId,
      actorName: userRecord?.name || userId,
      note: reason,
    };

    await db.collection("incidents").updateOne(
      { incidentId, companyId: company.companyId },
      {
        $set: {
          escalationLevel: newLevel,
          severity: newLevel >= 2 ? "critical" : "high",
          lastUpdated: now,
        },
        $push: { timeline: timelineEvent as any },
      }
    );

    return NextResponse.json({ success: true, escalationLevel: newLevel });
  } catch (error) {
    return handleAuthError(error);
  }
}
