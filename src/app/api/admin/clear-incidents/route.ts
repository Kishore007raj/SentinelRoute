import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

/**
 * ADMIN ONLY: Clear all incidents from incident_events collection.
 * Used for testing/debugging after fixes to allow fresh data generation.
 * 
 * Usage: POST /api/admin/clear-incidents?token=debug
 */
export async function POST(req: NextRequest) {
  try {
    // Simple token check (not secure, dev only)
    const token = req.nextUrl.searchParams.get("token");
    if (token !== "debug") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const result = await db.collection("incident_events").deleteMany({});

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} incidents. Fresh incidents will be generated on next intelligence fetch.`
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
