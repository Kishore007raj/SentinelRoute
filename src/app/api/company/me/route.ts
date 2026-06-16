import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken, adminAuth } from "@/lib/firebase-admin";
import type { Company, UserRecord } from "@/lib/types";

/**
 * GET /api/company/me
 *
 * Returns the authenticated user's UserRecord + linked Company.
 * 404 when no UserRecord exists (new user — must register).
 *
 * Lookup order:
 *   1. By userId (Firebase UID) — primary key
 *   2. By email resolved from Firebase Admin SDK — handles legacy seed records
 *      that stored email as userId, or accounts that haven't been re-seeded yet
 *   If found by email but userId doesn't match, the record is corrected in-place.
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

    // ── Primary lookup: by Firebase UID ──────────────────────────────────────
    let userRecord = await db
      .collection<UserRecord>("users")
      .findOne({ userId });

    // ── Fallback: resolve email from Firebase and look up by email ────────────
    // Handles legacy records where userId was stored as email (old seed bug)
    if (!userRecord && adminAuth) {
      try {
        const fbUser = await adminAuth.getUser(userId);
        if (fbUser.email) {
          const recordByEmail = await db
            .collection<UserRecord>("users")
            .findOne({ email: fbUser.email });

          if (recordByEmail) {
            // Correct the userId in-place so future lookups work by UID
            await db
              .collection("users")
              .updateOne(
                { email: fbUser.email },
                { $set: { userId } }
              );
            userRecord = { ...recordByEmail, userId };
          }
        }
      } catch {
        // Non-fatal — if Firebase Admin lookup fails, fall through to 404
      }
    }

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
