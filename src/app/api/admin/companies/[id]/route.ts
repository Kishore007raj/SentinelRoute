/**
 * GET  /api/admin/companies/[id]  — full company detail for super admin review
 * PATCH /api/admin/companies/[id] — lifecycle action on a company
 *
 * PATCH body: { action: "approve"|"reject"|"suspend"|"restore"|"clarification", note?: string }
 *
 * Valid lifecycle transitions:
 *   pending  → approve (→ approved)
 *   pending  → reject  (→ rejected)
 *   approved → suspend (→ suspended)
 *   suspended→ restore (→ approved)   [also called "reactivate"]
 *   any      → clarification          (status unchanged, note recorded)
 *
 * All mutations are audited via createAuditEvent → company_audits.
 * "restore" emits "company_reactivated" audit event (defined in AuditEventType).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";
import { adminLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";
import { createAuditEvent } from "@/lib/audit";
import type { Company, CompanyDocument } from "@/lib/types";

const VALID_ACTIONS = ["approve", "reject", "suspend", "clarification", "restore"] as const;
type LifecycleAction = typeof VALID_ACTIONS[number];

// Lifecycle transition guard — prevents invalid state changes
const VALID_TRANSITIONS: Record<string, LifecycleAction[]> = {
  pending:   ["approve", "reject", "clarification"],
  approved:  ["suspend", "clarification"],
  suspended: ["restore", "clarification"],
  rejected:  ["clarification"],
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rl = adminLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    await requireSuperAdmin(req);
    const { id: companyId } = await params;

    if (!companyId || typeof companyId !== "string") {
      return ApiErrors.badRequest("Invalid company ID");
    }

    const db = await getDb();

    const company = await db.collection<Company>("companies").findOne({ companyId });
    if (!company) return ApiErrors.notFound("Company");

    const documents = await db
      .collection<CompanyDocument>("company_documents")
      .find({ companyId })
      .project({ _id: 0 })
      .toArray();

    const [users, shipments, drivers, vehicles] = await Promise.all([
      db.collection("users").countDocuments({ companyId }),
      db.collection("shipments").countDocuments({ companyId }),
      db.collection("drivers").countDocuments({ companyId }),
      db.collection("vehicles").countDocuments({ companyId }),
    ]);

    // Strip _id before sending — never expose MongoDB internals
    const { _id: _cId, ...co } = company as Company & { _id: unknown };

    return NextResponse.json({
      company: co,
      documents,
      stats: { users, shipments, drivers, vehicles },
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  const rl = adminLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    const { userId } = await requireSuperAdmin(req);
    const { id: companyId } = await params;

    if (!companyId || typeof companyId !== "string") {
      return ApiErrors.badRequest("Invalid company ID");
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return ApiErrors.badRequest("Invalid JSON body");
    }

    const action = body.action as string;
    if (!VALID_ACTIONS.includes(action as LifecycleAction)) {
      return ApiErrors.badRequest(
        `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}`,
        "INVALID_ACTION",
        "action"
      );
    }

    const db = await getDb();

    const company = await db.collection<Company>("companies").findOne({ companyId });
    if (!company) return ApiErrors.notFound("Company");

    // Enforce valid lifecycle transitions
    const allowed = VALID_TRANSITIONS[company.status] ?? [];
    if (!allowed.includes(action as LifecycleAction)) {
      return ApiErrors.unprocessable(
        `Cannot '${action}' a company with status '${company.status}'. ` +
        `Allowed actions: ${allowed.join(", ") || "none"}.`
      );
    }

    const now = new Date().toISOString();

    // Map action → resulting status
    const statusMap: Record<LifecycleAction, Company["status"]> = {
      approve:       "approved",
      reject:        "rejected",
      suspend:       "suspended",
      restore:       "approved",
      clarification: company.status, // no change
    };
    const newStatus = statusMap[action as LifecycleAction];

    const update: Partial<Company> & Record<string, unknown> = { status: newStatus };
    if (action === "approve" || action === "restore") {
      update.approvedAt = now;
      update.approvedBy = userId;
    }

    await db.collection("companies").updateOne({ companyId }, { $set: update });

    // Map action → audit event type (all defined in AuditEventType)
    const auditEventMap: Record<LifecycleAction, string> = {
      approve:       "company_approved",
      reject:        "company_rejected",
      suspend:       "company_suspended",
      restore:       "company_reactivated", // defined in types.ts AuditEventType
      clarification: "company_registered",  // closest existing event for note-only action
    };

    // Fire-and-forget — audit never blocks the response
    createAuditEvent({
      db,
      companyId,
      eventType:   auditEventMap[action as LifecycleAction],
      performedBy: userId,
      description: String(body.note ?? `Company ${action}d by platform administrator.`),
      details: {
        action,
        previousStatus: company.status,
        newStatus,
        ...(body.note ? { note: String(body.note) } : {}),
      },
    }).catch(() => {/* already logged inside createAuditEvent */});

    const updated = await db.collection<Company>("companies").findOne({ companyId });
    const { _id, ...co } = updated as Company & { _id: unknown };

    return NextResponse.json({ company: co });
  } catch (err) {
    return handleAuthError(err);
  }
}
