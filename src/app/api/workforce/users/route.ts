import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getDb } from "@/lib/mongodb";
import {
  requireWorkforceRead,
  requireUserMgmt,
  handleAuthError,
  USER_MGMT_ROLES,
} from "@/lib/auth-helpers";
import { createWorkforceAuditEvent } from "@/lib/workforce-audit";
import type { CompanyUser, UserRole } from "@/lib/types";

// ─── Canonical role allowlist (Task 4) ───────────────────────────────────────

const VALID_USER_ROLES: readonly UserRole[] = [
  "super_admin",
  "company_admin",
  "company_manager",
  "fleet_manager",
  "operations_manager",
  "dispatcher",
  "driver",
] as const;

function isValidRole(r: string): r is UserRole {
  return (VALID_USER_ROLES as readonly string[]).includes(r);
}

// ─── GET /api/workforce/users ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let userId: string;
  let companyId: string;
  let isSuperAdmin: boolean;

  try {
    const result = await requireWorkforceRead(req);
    userId = result.userId;
    companyId = result.companyId;
    isSuperAdmin = result.userRecord.role === "super_admin";

    // Non-super_admin must be in USER_MGMT_ROLES to list users
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

    const users = await db
      .collection<CompanyUser>("company_users")
      .find({ companyId })
      .sort({ createdAt: -1 })
      .toArray();

    // Strip MongoDB internal _id before returning
    const cleaned = users.map(({ _id, ...rest }) => rest);

    // Task 7: audit super_admin cross-company reads (fire-and-forget)
    if (isSuperAdmin) {
      const db2 = await getDb();
      createWorkforceAuditEvent({
        db: db2,
        companyId,
        eventType:  "super_admin_read",
        actorId:    userId,
        targetId:   companyId,
        targetType: "user",
        details:    { action: "list_users", endpoint: "/api/workforce/users" },
      }).catch(() => {/* audit failures never crash the caller */});
    }

    return NextResponse.json({ users: cleaned, total: cleaned.length });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/workforce/users] DB error:", detail);
    return NextResponse.json(
      { error: "Failed to fetch users." },
      { status: 500 }
    );
  }
}

// ─── POST /api/workforce/users ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let actorId: string;
  let companyId: string;

  try {
    const result = await requireUserMgmt(req);
    actorId = result.userId;
    companyId = result.companyId;
  } catch (err) {
    return handleAuthError(err);
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { email, role } = body as { email?: string; role?: string };

  // Validate required fields
  if (!email || typeof email !== "string" || !email.trim()) {
    return NextResponse.json(
      { error: "Missing required field: email" },
      { status: 400 }
    );
  }
  if (!role || typeof role !== "string" || !role.trim()) {
    return NextResponse.json(
      { error: "Missing required field: role" },
      { status: 400 }
    );
  }
  // Task 4: reject any role value not in the canonical list
  if (!isValidRole(role.trim())) {
    return NextResponse.json(
      { error: `Invalid role: "${role}". Accepted roles: ${VALID_USER_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  // Resolve userId from Firebase Auth — fall back to email as pending placeholder
  let resolvedUserId: string;
  try {
    const fbUser = await getAuth().getUserByEmail(email.trim());
    resolvedUserId = fbUser.uid;
  } catch {
    // User not yet in Firebase Auth — use email as pending invite placeholder
    resolvedUserId = email.trim();
  }

  const now = new Date().toISOString();

  const newUser: CompanyUser = {
    companyId,
    userId: resolvedUserId,
    role: role.trim() as UserRole,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();

    await db.collection("company_users").insertOne({ ...newUser });

    // Fire-and-forget audit
    createWorkforceAuditEvent({
      db,
      companyId,
      eventType: "user_invited",
      actorId,
      targetId: resolvedUserId,
      targetType: "user",
      details: { email: email.trim(), role: role.trim() },
    }).catch((err) => {
      console.error("[POST /api/workforce/users] Audit write failed:", err);
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/workforce/users] DB insert error:", detail);
    return NextResponse.json(
      { error: `Failed to invite user: ${detail}` },
      { status: 500 }
    );
  }
}
