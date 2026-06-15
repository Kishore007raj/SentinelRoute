import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { Company, UserRecord } from "@/lib/types";

/**
 * GET /api/company/me
 *
 * Returns the authenticated user's UserRecord + linked Company.
 * 404 when no UserRecord exists (new user — must register).
 */
export async function GET(req: NextRequest) {
  let userId: string;

  try {
    const user = await verifyFirebaseToken(req);
    userId = user.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  try {
    const db = await getDb();

    const userRecord = await db
      .collection<UserRecord>("users")
      .findOne({ userId });

    if (!userRecord) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    // Super admins have no companyId — return early
    if (userRecord.role === "super_admin") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...ur } = userRecord as typeof userRecord & { _id: unknown };
      return NextResponse.json({ userRecord: ur, company: null });
    }

    const company = await db
      .collection<Company>("companies")
      .findOne({ companyId: userRecord.companyId });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id: _urId, ...ur } = userRecord as typeof userRecord & { _id: unknown };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id: _cId, ...co } = (company ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      userRecord: ur,
      company: company ? co : null,
    });
  } catch (err) {
    console.error("[GET /api/company/me]", err);
    return NextResponse.json({ error: "Failed to fetch company data" }, { status: 503 });
  }
}
