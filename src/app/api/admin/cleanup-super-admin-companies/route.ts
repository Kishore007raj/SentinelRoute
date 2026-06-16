import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken, adminAuth } from "@/lib/firebase-admin";
import type { UserRecord } from "@/lib/types";

/**
 * POST /api/admin/cleanup-super-admin-companies
 *
 * Removes accidental company + document records created when super admin accounts
 * were mis-routed to /company/register (because the seed stored email as userId
 * instead of the real Firebase UID).
 *
 * For each of the three known super admin emails:
 *   1. Resolves their Firebase UID
 *   2. Deletes any companies where companyId matches their UserRecord.companyId
 *      (unless companyId === "platform", which is the safe sentinel value)
 *   3. Deletes associated company_documents
 *   4. Resets their UserRecord.companyId back to "platform"
 *
 * Protected by SUPER_ADMIN_SEED_SECRET + valid Firebase ID token.
 * Idempotent — safe to call multiple times.
 *
 * Body: { secret: string }
 */

const SUPER_ADMIN_EMAILS = [
  "karthiknair1610@gmail.com",
  "hariprasadprkm@gmail.com",
  "kishore2110raj@gmail.com",
];

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  try {
    await verifyFirebaseToken(req);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Secret guard ──────────────────────────────────────────────────────────
  const seedSecret = process.env.SUPER_ADMIN_SEED_SECRET;
  if (!seedSecret || body.secret !== seedSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!adminAuth) {
    return NextResponse.json(
      { error: "Firebase Admin SDK not configured" },
      { status: 503 }
    );
  }

  try {
    const db = await getDb();

    const cleaned: Array<{
      email: string;
      companiesDeleted: number;
      documentsDeleted: number;
      userRecordFixed: boolean;
    }> = [];

    for (const email of SUPER_ADMIN_EMAILS) {
      // Resolve Firebase UID
      let firebaseUid: string;
      try {
        const fbUser = await adminAuth.getUserByEmail(email);
        firebaseUid = fbUser.uid;
      } catch {
        cleaned.push({ email, companiesDeleted: 0, documentsDeleted: 0, userRecordFixed: false });
        continue;
      }

      // Find the UserRecord by Firebase UID
      const userRecord = await db
        .collection<UserRecord>("users")
        .findOne({ userId: firebaseUid });

      let companiesDeleted = 0;
      let documentsDeleted = 0;

      if (userRecord && userRecord.companyId && userRecord.companyId !== "platform") {
        const accidentalCompanyId = userRecord.companyId;

        // Delete company_documents for this company
        const docsResult = await db
          .collection("company_documents")
          .deleteMany({ companyId: accidentalCompanyId });
        documentsDeleted = docsResult.deletedCount ?? 0;

        // Delete the company record itself
        const companyResult = await db
          .collection("companies")
          .deleteMany({ companyId: accidentalCompanyId });
        companiesDeleted = companyResult.deletedCount ?? 0;

        // Reset companyId back to "platform"
        await db
          .collection("users")
          .updateOne(
            { userId: firebaseUid },
            { $set: { companyId: "platform", role: "super_admin" } }
          );
      }

      // Also clean up any audit events created under the accidental company
      // (best-effort, non-fatal)
      if (userRecord?.companyId && userRecord.companyId !== "platform") {
        await db
          .collection("audit_events")
          .deleteMany({ companyId: userRecord.companyId })
          .catch(() => {});
      }

      cleaned.push({
        email,
        companiesDeleted,
        documentsDeleted,
        userRecordFixed: true,
      });
    }

    return NextResponse.json({ cleaned });
  } catch (err) {
    console.error("[POST /api/admin/cleanup-super-admin-companies]", err);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
