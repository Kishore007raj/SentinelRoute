/**
 * GET /api/auth/redirect
 *
 * Returns the appropriate redirect URL based on user role.
 * - Super admin → /admin
 * - Regular user → /dashboard (or previous redirect URL)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fallback = url.searchParams.get("fallback") ?? "/dashboard";

    // First, get basic auth (just userId)
    const authResult = await requireAuth(req);

    // Then, get user details from DB
    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ userId: authResult.userId });

    if (!userRecord) {
      return NextResponse.json({ redirect: fallback });
    }

    const isSuperAdmin = userRecord.role === "super_admin";

    // Super admins always go to admin panel
    if (isSuperAdmin) {
      return NextResponse.json({ redirect: "/admin" });
    }

    // Regular users go to fallback (or dashboard)
    return NextResponse.json({ redirect: fallback });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
