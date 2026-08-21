import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { utcNow } from "@/lib/time";

/**
 * POST /api/intelligence/alerts/[id]/snooze
 * Snoozes an alert for a specified duration.
 * Body: { snoozeDurationMinutes: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { company } = await requireCompany(req);
    const { id: alertId } = params;

    const body = await req.json().catch(() => ({}));
    const { snoozeDurationMinutes = 60 } = body;

    if (snoozeDurationMinutes <= 0 || snoozeDurationMinutes > 1440) {
      return NextResponse.json(
        { error: "snoozeDurationMinutes must be between 1 and 1440" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const snoozeUntil = new Date(
      Date.now() + snoozeDurationMinutes * 60 * 1000
    ).toISOString();

    const result = await db.collection("operational_alerts").updateOne(
      { alertId, companyId: company.companyId },
      { $set: { snoozeUntil, lastUpdated: utcNow() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, snoozeUntil });
  } catch (error) {
    return handleAuthError(error);
  }
}
