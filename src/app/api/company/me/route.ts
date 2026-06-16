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
 * Self-healing for super admins:
 *   - If the caller's email is in SUPER_ADMIN_EMAILS, their UserRecord is corrected
 *     to role=super_admin, companyId=platform on every request.
 *   - This fixes accounts that accidentally registered a company before being seeded,
 *     and handles the case where the seed stored email as userId instead of Firebase UID.
 *   - Works with or without Firebase Admin SDK (JWT decode fallback for email).
 *   - If no record exists at all for a known super admin, one is created automatically.
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

    // ── Step 1: Resolve caller email ─────────────────────────────────────────
    // Used to detect known super admin accounts regardless of what's in MongoDB.
    let callerEmail: string | null = null;

    // Method A: Firebase Admin SDK (most reliable)
    if (adminAuth) {
      try {
        const fbUser = await adminAuth.getUser(userId);
        callerEmail = fbUser.email ?? null;
      } catch {
        // non-fatal — fall through to JWT decode
      }
    }

    // Method B: JWT payload decode (works without Admin SDK, email is a standard claim)
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

    const isSuperAdminEmail =
      callerEmail !== null && SUPER_ADMIN_EMAILS.includes(callerEmail);

    // ── Step 2: Look up UserRecord ────────────────────────────────────────────
    // Primary: by Firebase UID (correct path)
    let rawRecord = await db
      .collection<UserRecord>("users")
      .findOne({ userId });

    // Fallback: by email (handles old seed records where userId=email)
    if (!rawRecord && callerEmail) {
      rawRecord = await db
        .collection<UserRecord>("users")
        .findOne({ email: callerEmail });

      if (rawRecord) {
        // Migrate: update the stored userId to the real Firebase UID
        await db
          .collection("users")
          .updateOne({ email: callerEmail }, { $set: { userId } });
      }
    }

    // ── Step 3: Self-heal super admin records ─────────────────────────────────
    if (rawRecord && isSuperAdminEmail) {
      const needsFix =
        rawRecord.role !== "super_admin" || rawRecord.companyId !== "platform";

      if (needsFix) {
        await db
          .collection("users")
          .updateOne(
            { email: callerEmail! },
            { $set: { role: "super_admin", companyId: "platform", userId } }
          );
        // Return corrected data immediately without re-querying
        const correctedRecord: UserRecord = {
          userId,
          companyId: "platform",
          name:      rawRecord.name || callerEmail!,
          email:     callerEmail!,
          role:      "super_admin",
          active:    rawRecord.active ?? true,
          createdAt: rawRecord.createdAt,
        };
        return NextResponse.json({ userRecord: correctedRecord, company: null });
      }
    }

    // ── Step 4: Auto-create record for known super admin with no record at all ─
    if (!rawRecord) {
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
        return NextResponse.json({ userRecord: newRecord, company: null });
      }
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    // ── Step 5: Return for super admins ──────────────────────────────────────
    if (rawRecord.role === "super_admin") {
      // Strip _id before returning
      const { _id: _ignored, ...ur } = rawRecord as UserRecord & { _id?: unknown };
      void _ignored;
      return NextResponse.json({ userRecord: ur, company: null });
    }

    // ── Step 6: Return for regular company users ──────────────────────────────
    const company = await db
      .collection<Company>("companies")
      .findOne({ companyId: rawRecord.companyId });

    const { _id: _urId, ...ur } = rawRecord as UserRecord & { _id?: unknown };
    void _urId;
    const { _id: _cId, ...co } = (company ?? {}) as Record<string, unknown>;
    void _cId;

    return NextResponse.json({
      userRecord: ur,
      company: company ? co : null,
    });
  } catch (err) {
    console.error("[GET /api/company/me]", err);
    return NextResponse.json({ error: "Failed to fetch company data" }, { status: 503 });
  }
}
