import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireWorkforceRead, handleAuthError } from "@/lib/auth-helpers";

/**
 * GET /api/workforce/audits?targetId=<id>
 *
 * Returns all workforce_audits records for the authenticated user's company
 * where targetId matches the provided query param.
 * Results are sorted by timestamp descending (most recent first).
 *
 * Auth: requireWorkforceRead (same roles as any workforce GET)
 */
export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireWorkforceRead>>;
  try {
    auth = await requireWorkforceRead(req);
  } catch (err) {
    return handleAuthError(err);
  }

  const { companyId } = auth;
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("targetId");

  if (!targetId) {
    return NextResponse.json(
      { error: "targetId query parameter is required." },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    const records = await db
      .collection("workforce_audits")
      .find({ companyId, targetId })
      .sort({ timestamp: -1 })
      .toArray();

    // Strip MongoDB _id from each record
    const audits = records.map(({ _id, ...rest }) => rest);

    return NextResponse.json({ audits });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/workforce/audits] DB error:", detail);
    return NextResponse.json(
      { error: "Failed to fetch audit records." },
      { status: 503 }
    );
  }
}
