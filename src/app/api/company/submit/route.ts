import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { UserRecord } from "@/lib/types";
import { createAuditEvent } from "@/lib/audit";

/**
 * POST /api/company/submit
 *
 * Marks company as submitted for verification (stays "pending").
 * Records a submission audit event.
 */
export async function POST(req: NextRequest) {
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

    const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
    if (!userRecord?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Check documents — require all 5
    const docs = await db
      .collection("company_documents")
      .find({ companyId: userRecord.companyId })
      .toArray();

    const requiredTypes = ["gst", "pan", "insurance", "transport_license", "fleet_insurance"];
    const uploadedTypes = docs.map((d) => d.type as string);
    const missing = requiredTypes.filter((t) => !uploadedTypes.includes(t));

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required documents: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Update company submittedAt (add field)
    await db.collection("companies").updateOne(
      { companyId: userRecord.companyId },
      { $set: { submittedAt: now, status: "pending" } }
    );

    // Task 3: canonical audit event (replaces old inline insert)
    await createAuditEvent({
      db,
      companyId:   userRecord.companyId,
      eventType:   "verification_submitted",
      performedBy: userId,
      description: "All verification documents submitted. Awaiting super admin review.",
      details:     { documentCount: docs.length },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/company/submit]", err);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
