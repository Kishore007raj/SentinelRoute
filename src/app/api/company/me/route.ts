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
 *
 * Self-healing: if the resolved user's email is a known super admin email,
 * the UserRecord is corrected to role=super_admin, companyId=platform on the spot.
 * This fixes accounts that accidentally registered a company before being seeded.
 */

const SUPER_ADMIN_EMAILS = [
  "karthiknair1610@gmail.com",
  "hariprasadprkm@gmail.com",
  "kishore2110raj@gmail.com",
];

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

    // ── Resolve user email ────────────────────────────────────────────────────
    // Try Firebase Admin SDK first; fall back to JWT decode
    let callerEmail: string | null = null;
    if (adminAuth) {
      try {
        const fbUser = await adminAuth.getUser(userId);
        callerEmail = fbUser.email ?? null;
      } catch {
        // non-fatal
      }
    }
    // JWT decode fallback (works without Admin SDK)
    if (!callerEmail) {
      try {
        const authHeader = req.headers.get("authorization") ?? "";
        const token = authHeader.slice(7).trim();
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
          ) as Record<string, unknown>;
          callerEmail = typeof payload.email === "string" ? payload.email : null;
        }
      } catch {
        // non-fatal
      }
    }

    const isSuperAdminEmail = callerEmail !== null && SUPER_ADMIN_EMAILS.includes(callerEmail);

    // ── Primary lookup: by Firebase UID ──────────────────────────────────────
    let userRecord = await db
      .collection<UserRecord>("users")
      .findOne({ userId });

    // ── Fallback: look up by email if UID lookup missed ───────────────────────
    if (!userRecord && callerEmail) {
      const recordByEmail = await db
        .collection<UserRecord>("users")
        .findOne({ email: callerEmail });

      if (recordByEmail) {
        // Correct the userId so future lookups work by UID
        await db
          .collection("users")
          .updateOne({ email: callerEmail }, { $set: { userId } });
        userRecord = { ...recordByEmail, userId };
      }
    }

    // ── Self-heal: correct super admin records that got polluted ─────────────
    // Triggers when:
    //   a) A super admin account was redirected to /company/register before seeding (has role=company_admin)
    //   b) The seed ran with userId=email instead of real UID (stale record found by email fallback above)
    if (userRecord && isSuperAdminEmail) {
      const needsFix =
        userRecord.role !== "super_admin" ||
        userRecord.companyId !== "platform";

      if (needsFix) {
        await db.collection("users").updateOne(
          { userId: userRecord.userId },
          { $set: { role: "super_admin", companyId: "platform" } }
        );
        userRecord = { ...userRecord, role: "super_admin", companyId: "platform" };
      }
    }

    // ── Still no record — new user, must register ─────────────────────────────
    if (!userRecord) {
      // If this is a known super admin email with no record at all, create one now
      if (isSuperAdminEmail && callerEmail) {
        const now = new Date().toISOString();
        const newRecord: UserRecord = {
          userId,
          companyId: "platform",
          name:      callerEmail,
          email:     callerEmail,
          role:      "super_admin",
          active:    true,
          createdAt: now,
        };
        await db.collection("users").insertOne(newRecord);
        userRecord = newRecord;
      } else {
        return NextResponse.json({ error: "User record not found" }, { status: 404 });
      }
    }

    // ── Return for super admins ───────────────────────────────────────────────
    if (userRecord.role === "super_admin") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...ur } = userRecord as typeof userRecord & { _id: unknown };
      return NextResponse.json({ userRecord: ur, company: null });
    }

    // ── Return for regular users ──────────────────────────────────────────────
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
