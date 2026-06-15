import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { Company, UserRecord, CompanyDocument } from "@/lib/types";
import { createAuditEvent } from "@/lib/audit";

/**
 * GET /api/admin/companies/[id]
 * Returns full company detail + documents for super admin review.
 *
 * PATCH /api/admin/companies/[id]
 * Updates company status: { action: "approve" | "reject" | "suspend" | "clarification", note?: string }
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  const { id: companyId } = await params;

  try {
    const db = await getDb();

    const actor = await db.collection<UserRecord>("users").findOne({ userId });
    if (actor?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const company = await db.collection<Company>("companies").findOne({ companyId });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const documents = await db
      .collection<CompanyDocument>("company_documents")
      .find({ companyId })
      .toArray();

    const { _id: _cId, ...co } = company as Company & { _id: unknown };
    void _cId;
    const cleanDocs = documents.map(({ _id, ...d }: CompanyDocument & { _id: unknown }) => { void _id; return d; });

    return NextResponse.json({ company: co, documents: cleanDocs });
  } catch (err) {
    console.error("[GET /api/admin/companies/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch company" }, { status: 503 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  const { id: companyId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as string;
  if (!["approve", "reject", "suspend", "clarification"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const db = await getDb();

    const actor = await db.collection<UserRecord>("users").findOne({ userId });
    if (actor?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const company = await db.collection<Company>("companies").findOne({ companyId });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    const statusMap: Record<string, Company["status"]> = {
      approve:       "approved",
      reject:        "rejected",
      suspend:       "suspended",
      clarification: company.status, // stays same
    };

    const newStatus = statusMap[action];
    const update: Partial<Company> = { status: newStatus };

    if (action === "approve") {
      update.approvedAt = now;
      update.approvedBy = userId;
    }

    await db.collection("companies").updateOne(
      { companyId },
      { $set: update }
    );

    // Task 3: map action to canonical audit event type
    const auditEventMap: Record<string, string> = {
      approve:       "company_approved",
      reject:        "company_rejected",
      suspend:       "company_suspended",
      clarification: "company_registered", // no status change — use generic
    };

    await createAuditEvent({
      db,
      companyId,
      eventType:   auditEventMap[action] ?? `company.${action}`,
      performedBy: userId,
      description: String(body.note ?? `Company ${action}d by super admin.`),
      details:     { action, previousStatus: company.status, newStatus },
    });

    const updated = await db.collection<Company>("companies").findOne({ companyId });
    const { _id, ...co } = updated as Company & { _id: unknown };
    void _id;

    return NextResponse.json({ company: co });
  } catch (err) {
    console.error("[PATCH /api/admin/companies/[id]]", err);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}
