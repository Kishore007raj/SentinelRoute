import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { UserRecord } from "@/lib/types";

/**
 * POST /api/admin/seed-super-admin
 *
 * Seeds all three known super admin accounts. Idempotent — safe to call multiple times.
 * Protected by SUPER_ADMIN_SEED_SECRET env var AND requires a valid Firebase ID token.
 *
 * Body: { secret: string }
 *
 * Returns: { created: number, upgraded: number, alreadyAdmin: number, emails: string[] }
 */

const SUPER_ADMIN_EMAILS = [
  "karthiknair1610@gmail.com",
  "hariprasadprkm@gmail.com",
  "kishore2110raj@gmail.com",
];

export async function POST(req: NextRequest) {
  // ── Authentication check (unchanged) ─────────────────────────────────────
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

  // ── Secret guard (unchanged) ──────────────────────────────────────────────
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

  // ── Seed all three known super admins ─────────────────────────────────────
  try {
    const db = await getDb();
    const now = new Date().toISOString();

    let created = 0;
    let upgraded = 0;
    let alreadyAdmin = 0;

    for (const email of SUPER_ADMIN_EMAILS) {
      const existing = await db.collection<UserRecord>("users").findOne({ email });

      if (existing) {
        if (existing.role === "super_admin") {
          alreadyAdmin++;
        } else {
          // Upgrade existing user to super_admin
          await db.collection("users").updateOne(
            { email },
            { $set: { role: "super_admin" } }
          );
          upgraded++;
        }
      } else {
        // Insert new UserRecord for this email
        const newUser: UserRecord = {
          userId:    email,
          companyId: "platform",
          name:      email,
          email,
          role:      "super_admin",
          active:    true,
          createdAt: now,
        };
        await db.collection("users").insertOne(newUser);
        created++;
      }
    }

    return NextResponse.json(
      {
        created,
        upgraded,
        alreadyAdmin,
        emails: SUPER_ADMIN_EMAILS,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/admin/seed-super-admin]", err);
    return NextResponse.json({ error: "Failed to seed super admins" }, { status: 500 });
  }
}
