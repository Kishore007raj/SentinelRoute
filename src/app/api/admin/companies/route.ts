import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { Company, UserRecord } from "@/lib/types";

/**
 * GET /api/admin/companies
 *
 * Returns all companies (with optional ?status= filter).
 * Requires super_admin role.
 */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  try {
    const db = await getDb();

    // Verify super_admin
    const actor = await db.collection<UserRecord>("users").findOne({ userId });
    if (actor?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const query = statusFilter ? { status: statusFilter as Company["status"] } : {};

    const companies = await db
      .collection<Company>("companies")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const cleaned = companies.map(({ _id, ...c }: Company & { _id: unknown }) => c);
    return NextResponse.json({ companies: cleaned, total: cleaned.length });
  } catch (err) {
    console.error("[GET /api/admin/companies]", err);
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 503 });
  }
}
