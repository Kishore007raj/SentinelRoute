import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken, adminAuth } from "@/lib/firebase-admin";
import type { UserRecord } from "@/lib/types";

/**
 * POST /api/admin/seed-super-admin
 *
 * Seeds all three known super admin accounts. Idempotent — safe to call multiple times.
 * Protected by SUPER_ADMIN_SEED_SECRET env var AND requires a valid Firebase ID token.
 *
 * Uses Firebase Admin SDK getUserByEmail() to resolve the real Firebase UID for each
 * email, ensuring the stored userId matches what /api/company/me looks up.
 *
 * Body: { secret: string }
 *
 * Returns: { created, upgraded, alreadyAdmin, skipped, results, emails }
 */

const SUPER_ADMIN_EMAILS = [
  "karthiknair1610@gmail.com",
  "hariprasadprkm@gmail.com",
  "kishore2110raj@gmail.com",
];

export async function POST(req: NextRequest) {
  // ── Authentication check ──────────────────────────────────────────────────
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
  if (!seedSecret) {
    return NextResponse.json(
      { error: "SUPER_ADMIN_SEED_SECRET not configured" },
      { status: 503 }
    );
  }

  if (body.secret !== seedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  // ── Require Admin SDK — needed to resolve Firebase UIDs by email ──────────
  if (!adminAuth) {
    return NextResponse.json(
      {
        error:
          "Firebase Admin SDK not configured. " +
          "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY " +
          "must be set in environment variables.",
      },
      { status: 503 }
    );
  }

  // ── Seed all three known super admins ─────────────────────────────────────
  try {
    const db  = await getDb();
    const now = new Date().toISOString();

    let created      = 0;
    let upgraded     = 0;
    let alreadyAdmin = 0;
    let skipped      = 0;

    const results: Array<{
      email:  string;
      uid:    string | null;
      status: "created" | "upgraded" | "already_admin" | "not_in_firebase";
    }> = [];

    for (const email of SUPER_ADMIN_EMAILS) {
      // ── Resolve Firebase UID ─────────────────────────────────────────────
      let firebaseUid: string | null = null;
      try {
        const fbUser = await adminAuth.getUserByEmail(email);
        firebaseUid = fbUser.uid;
      } catch (fbErr: unknown) {
        const code = (fbErr as { code?: string }).code ?? "";
        if (code === "auth/user-not-found") {
          // Email not registered in Firebase Auth yet — skip for now
          results.push({ email, uid: null, status: "not_in_firebase" });
          skipped++;
          continue;
        }
        throw fbErr; // unexpected error — bubble up
      }

      // ── Upsert UserRecord by userId (Firebase UID) ───────────────────────
      // Also clean up any stale record that used email as userId (old seed bug)
      await db.collection("users").deleteMany({
        email,
        userId: { $ne: firebaseUid },
      });

      const existing = await db
        .collection<UserRecord>("users")
        .findOne({ userId: firebaseUid });

      if (existing) {
        if (existing.role === "super_admin") {
          // Already correct — ensure email field is up to date
          await db
            .collection("users")
            .updateOne({ userId: firebaseUid }, { $set: { email } });
          alreadyAdmin++;
          results.push({ email, uid: firebaseUid, status: "already_admin" });
        } else {
          // Existing user (e.g. they registered as company_admin) — upgrade
          await db.collection("users").updateOne(
            { userId: firebaseUid },
            { $set: { role: "super_admin", companyId: "platform", email } }
          );
          upgraded++;
          results.push({ email, uid: firebaseUid, status: "upgraded" });
        }
      } else {
        // No record at all — create one with the correct Firebase UID
        const newUser: UserRecord = {
          userId:    firebaseUid,
          companyId: "platform",
          name:      email,
          email,
          role:      "super_admin",
          active:    true,
          createdAt: now,
        };
        await db.collection("users").insertOne(newUser);
        created++;
        results.push({ email, uid: firebaseUid, status: "created" });
      }
    }

    return NextResponse.json({
      created,
      upgraded,
      alreadyAdmin,
      skipped,
      results,
      emails: SUPER_ADMIN_EMAILS,
    });
  } catch (err) {
    console.error("[POST /api/admin/seed-super-admin]", err);
    return NextResponse.json({ error: "Failed to seed super admins" }, { status: 500 });
  }
}
