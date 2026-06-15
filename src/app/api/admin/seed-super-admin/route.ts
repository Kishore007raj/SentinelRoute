import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { UserRecord } from "@/lib/types";

/**
 * POST /api/admin/seed-super-admin
 *
 * One-time endpoint: creates a super_admin UserRecord for the authenticated user.
 * Protected by SUPER_ADMIN_SEED_SECRET env var.
 *
 * This is the bootstrap mechanism: the first super admin is created via this endpoint,
 * then they can manage companies via the admin panel.
 *
 * Body: { secret: string }
 */
export async function POST(req: NextRequest) {
  let userId: string;
  let userEmail: string | undefined;

  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.slice(7).trim();
    try {
      const parts = token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
      userEmail = payload.email as string | undefined;
    } catch { /* non-fatal */ }
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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

  try {
    const db = await getDb();

    // Idempotent — if already super admin, return existing
    const existing = await db.collection<UserRecord>("users").findOne({ userId });
    if (existing) {
      if (existing.role === "super_admin") {
        const { _id, ...ur } = existing as UserRecord & { _id: unknown };
        void _id;
        return NextResponse.json({ userRecord: ur, message: "Already super admin" });
      }
      // Upgrade existing user to super admin
      await db.collection("users").updateOne(
        { userId },
        { $set: { role: "super_admin" } }
      );
      const updated = await db.collection<UserRecord>("users").findOne({ userId });
      const { _id, ...ur } = updated as UserRecord & { _id: unknown };
      void _id;
      return NextResponse.json({ userRecord: ur, message: "Upgraded to super admin" });
    }

    const now = new Date().toISOString();
    const userRecord: UserRecord = {
      userId,
      companyId: "platform",
      name:      userEmail ?? userId,
      email:     userEmail ?? "",
      role:      "super_admin",
      active:    true,
      createdAt: now,
    };

    await db.collection("users").insertOne(userRecord);
    return NextResponse.json({ userRecord, message: "Super admin created" }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/seed-super-admin]", err);
    return NextResponse.json({ error: "Failed to create super admin" }, { status: 500 });
  }
}
