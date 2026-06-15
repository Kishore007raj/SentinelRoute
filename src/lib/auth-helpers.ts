/**
 * auth-helpers.ts — Reusable server-side authorization helpers.
 *
 * All future API routes must use these helpers instead of inline
 * verifyFirebaseToken + DB lookups. This enforces consistent, auditable
 * authorization across every endpoint.
 *
 * Usage:
 *   const { userId } = await requireAuth(req);
 *   const { userId, userRecord, company } = await requireCompany(req);
 *   const { userId, userRecord, company } = await requireCompanyAdmin(req);
 *   const { userId, userRecord } = await requireSuperAdmin(req);
 *   const { userId, userRecord, company } = await requireRole(req, "dispatcher");
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { Company, UserRecord, UserRole } from "@/lib/types";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface AuthResult {
  userId: string;
}

export interface CompanyAuthResult extends AuthResult {
  userRecord: UserRecord;
  company:    Company;
}

export interface AdminAuthResult extends AuthResult {
  userRecord: UserRecord;
}

// ─── Error factory ────────────────────────────────────────────────────────────

function forbidden(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

function unauthorized(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

function notFound(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

/**
 * Verifies Firebase ID token.
 * Throws a Response on failure — call with try/catch and return the thrown value.
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const verified = await verifyFirebaseToken(req);
  return { userId: verified.uid };
}

// ─── requireCompany ──────────────────────────────────────────────────────────

/**
 * Verifies auth + resolves the user's company.
 * Throws 401 if not authenticated.
 * Throws 404 if user has no UserRecord or no company.
 * Throws 403 if the company is suspended.
 */
export async function requireCompany(req: NextRequest): Promise<CompanyAuthResult> {
  let userId: string;
  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
  } catch (err) {
    if (err instanceof Response) throw err;
    throw unauthorized("Authentication service unavailable");
  }

  const db = await getDb();

  const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
  if (!userRecord) throw notFound("User record not found. Please complete company registration.");
  if (!userRecord.companyId) throw notFound("No company associated with this account.");

  const company = await db.collection<Company>("companies").findOne({ companyId: userRecord.companyId });
  if (!company) throw notFound("Company record not found.");

  // Task 6: suspended companies are fully blocked at the API layer
  if (company.status === "suspended") {
    throw forbidden("Company account is suspended. Contact support.");
  }

  return { userId, userRecord, company };
}

// ─── requireApprovedCompany ──────────────────────────────────────────────────

/**
 * Same as requireCompany but additionally requires the company to be approved.
 * Pending/rejected companies cannot access operational endpoints.
 */
export async function requireApprovedCompany(req: NextRequest): Promise<CompanyAuthResult> {
  const result = await requireCompany(req);

  if (result.company.status !== "approved") {
    throw forbidden(
      `Company is ${result.company.status}. Operational access requires an approved company.`
    );
  }

  return result;
}

// ─── requireCompanyAdmin ─────────────────────────────────────────────────────

/**
 * Requires auth + approved company + company_admin or super_admin role.
 */
export async function requireCompanyAdmin(req: NextRequest): Promise<CompanyAuthResult> {
  const result = await requireApprovedCompany(req);

  const adminRoles: UserRole[] = ["company_admin", "super_admin"];
  if (!adminRoles.includes(result.userRecord.role)) {
    throw forbidden("This action requires company admin privileges.");
  }

  return result;
}

// ─── requireSuperAdmin ───────────────────────────────────────────────────────

/**
 * Requires auth + super_admin role.
 * Does NOT check company status — super admins are platform-level.
 */
export async function requireSuperAdmin(req: NextRequest): Promise<AdminAuthResult> {
  let userId: string;
  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
  } catch (err) {
    if (err instanceof Response) throw err;
    throw unauthorized("Authentication service unavailable");
  }

  const db = await getDb();
  const userRecord = await db.collection<UserRecord>("users").findOne({ userId });

  if (!userRecord || userRecord.role !== "super_admin") {
    throw forbidden("Super admin access required.");
  }

  return { userId, userRecord };
}

// ─── requireRole ─────────────────────────────────────────────────────────────

/**
 * Requires auth + approved company + a specific role (or super_admin override).
 * super_admin always passes any role check.
 */
export async function requireRole(
  req: NextRequest,
  role: UserRole
): Promise<CompanyAuthResult> {
  const result = await requireApprovedCompany(req);

  if (result.userRecord.role !== role && result.userRecord.role !== "super_admin") {
    throw forbidden(`This action requires the '${role}' role.`);
  }

  return result;
}

// ─── handleAuthError ─────────────────────────────────────────────────────────

/**
 * Converts a thrown Response from any require* helper into a NextResponse.
 * Use in every route's catch block:
 *
 *   } catch (err) {
 *     return handleAuthError(err);
 *   }
 */
export function handleAuthError(err: unknown): NextResponse {
  if (err instanceof Response) {
    return new NextResponse(err.body, {
      status:  err.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  console.error("[auth-helpers] Unexpected error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
