/**
 * GET   /api/workforce/users/[id] — fetch a single company_user by userId
 * PATCH /api/workforce/users/[id] — update active status or role
 *
 * Auth:
 *   GET  — requireWorkforceRead; then check role is in USER_MGMT_ROLES or super_admin.
 *           Returns 403 "Company Manager access required." for other roles.
 *   PATCH — requireUserMgmt (company_manager / company_admin only).
 *
 * The [id] param is the target user's userId (Firebase UID).
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  requireWorkforceRead,
  requireUserMgmt,
  handleAuthError,
  USER_MGMT_ROLES,
} from "@/lib/auth-helpers";
import { createWorkforceAuditEvent } from "@/lib/workforce-audit";
import type { CompanyUser, UserRole } from "@/lib/types";

// ─── GET /api/workforce/users/[id] ───────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;

  let companyId: string;
  let isSuperAdmin: boolean;

  try {
    const result = await requireWorkforceRead(req);
    companyId = result.companyId;
    isSuperAdmin = result.userRecord.role === "super_admin";

    // Non-super_admin must be in USER_MGMT_ROLES to read user detail
    if (!isSuperAdmin && !USER_MGMT_ROLES.includes(result.userRecord.role)) {
      return NextResponse.json(
        { error: "Company Manager access required." },
        { status: 403 }
      );
    }
  } catch (err) {
    return handleAuthError(err);
  }

  // super_admin must supply ?companyId= to scope the query
  if (isSuperAdmin && !companyId) {
    return NextResponse.json(
      { error: "?companyId= query parameter is required for super_admin." },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    const user = await db
      .collection<CompanyUser>("company_users")
      .findOne({ userId: targetUserId, companyId });

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // Strip MongoDB internal _id
    const { _id, ...cleaned } = user as CompanyUser & { _id?: unknown };

    return NextResponse.json({ user: cleaned });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/workforce/users/[id]] DB error:", detail);
    return NextResponse.json(
      { error: "Failed to fetch user." },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/workforce/users/[id] ─────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;

  let actorId: string;
  let companyId: string;

  try {
    const result = await requireUserMgmt(req);
    actorId = result.userId;
    companyId = result.companyId;
  } catch (err) {
    return handleAuthError(err);
  }

  // Self-modification guard
  if (targetUserId === actorId) {
    return NextResponse.json(
      { error: "You cannot modify your own account via this API." },
      { status: 403 }
    );
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { active, role } = body as { active?: boolean; role?: string };

  // At least one field must be provided
  if (active === undefined && role === undefined) {
    return NextResponse.json(
      { error: "No updatable fields provided. Supply 'active' or 'role'." },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    // Fetch existing record (needed for role change previousRole + 404 check)
    const existing = await db
      .collection<CompanyUser>("company_users")
      .findOne({ userId: targetUserId, companyId });

    if (!existing) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const updates: Partial<CompanyUser> & { updatedAt: string } = { updatedAt: now };

    // Determine audit event type and details
    let eventType: "user_disabled" | "user_activated" | "user_role_changed";
    let auditDetails: Record<string, unknown> = {};

    if (active === false) {
      updates.active = false;
      eventType = "user_disabled";
    } else if (active === true) {
      updates.active = true;
      eventType = "user_activated";
    } else {
      // role change path — active was undefined so role must be present
      const previousRole = existing.role;
      const newRole = (role as UserRole);
      updates.role = newRole;
      eventType = "user_role_changed";
      auditDetails = { previousRole, newRole };
    }

    await db
      .collection("company_users")
      .updateOne(
        { userId: targetUserId, companyId },
        { $set: updates }
      );

    // Fetch the updated record to return clean shape
    const updated = await db
      .collection<CompanyUser>("company_users")
      .findOne({ userId: targetUserId, companyId });

    // Fire-and-forget audit
    createWorkforceAuditEvent({
      db,
      companyId,
      eventType,
      actorId,
      targetId: targetUserId,
      targetType: "user",
      details: auditDetails,
    }).catch((err) => {
      console.error("[PATCH /api/workforce/users/[id]] Audit write failed:", err);
    });

    // Strip _id
    const { _id, ...cleaned } = (updated ?? { ...existing, ...updates }) as CompanyUser & { _id?: unknown };

    return NextResponse.json({ user: cleaned });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[PATCH /api/workforce/users/[id]] DB error:", detail);
    return NextResponse.json(
      { error: `Failed to update user: ${detail}` },
      { status: 500 }
    );
  }
}
