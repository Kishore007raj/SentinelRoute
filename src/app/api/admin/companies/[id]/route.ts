import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";
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
  try {
    const { userId } = await requireSuperAdmin(req);
    const { id: companyId } = await params;
    const db = await getDb();

    const company = await db.collection<Company>("companies").findOne({ companyId });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const documents = await db
      .collection<CompanyDocument>("company_documents")
      .find({ companyId })
      .toArray();

    const [users, shipments, drivers, vehicles] = await Promise.all([
      db.collection("users").countDocuments({ companyId }),
      db.collection("shipments").countDocuments({ companyId }),
      db.collection("drivers").countDocuments({ companyId }),
      db.collection("vehicles").countDocuments({ companyId }),
    ]);

    const { _id: _cId, ...co } = company as Company & { _id: unknown };
    const cleanDocs = documents.map(({ _id, ...d }: CompanyDocument & { _id: unknown }) => d);

    return NextResponse.json({ 
      company: co, 
      documents: cleanDocs,
      stats: { users, shipments, drivers, vehicles }
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireSuperAdmin(req);
    const { id: companyId } = await params;
    
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = body.action as string;
    if (!["approve", "reject", "suspend", "clarification", "restore"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const db = await getDb();

    const company = await db.collection<Company>("companies").findOne({ companyId });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    const statusMap: Record<string, Company["status"]> = {
      approve:       "approved",
      reject:        "rejected",
      suspend:       "suspended",
      restore:       "approved",
      clarification: company.status,
    };

    const newStatus = statusMap[action];
    const update: Partial<Company> = { status: newStatus };

    if (action === "approve" || action === "restore") {
      update.approvedAt = now;
      update.approvedBy = userId;
    }

    await db.collection("companies").updateOne(
      { companyId },
      { $set: update }
    );

    const auditEventMap: Record<string, string> = {
      approve:       "company_approved",
      reject:        "company_rejected",
      suspend:       "company_suspended",
      restore:       "company_restored",
      clarification: "company_registered",
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

    return NextResponse.json({ company: co });
  } catch (err) {
    return handleAuthError(err);
  }
}
