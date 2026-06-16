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

// ─── Workforce Role Matrix ─────────────────────────────────────────────────

/**
 * Roles allowed to perform READ operations on workforce data.
 * driver is intentionally absent — drivers use a separate guard.
 */
export const WORKFORCE_READ_ROLES: UserRole[] = [
  "company_manager", "company_admin", "fleet_manager",
  "operations_manager", "dispatcher", "super_admin",
];

/**
 * Roles allowed to perform WRITE (POST/PATCH/DELETE) operations on
 * driver and vehicle records.
 */
export const WORKFORCE_WRITE_ROLES: UserRole[] = [
  "company_manager", "company_admin", "fleet_manager",
];

/**
 * Roles allowed to manage company users (invite, disable, role-change).
 */
export const USER_MGMT_ROLES: UserRole[] = [
  "company_manager", "company_admin",
];

/**
 * Roles allowed to access the workforce dashboard.
 */
export const DASHBOARD_ROLES: UserRole[] = [
  "company_manager", "company_admin", "fleet_manager",
  "operations_manager", "super_admin",
];

// ─── requireWorkforceRead ─────────────────────────────────────────────────

/**
 * Requires auth + approved company + a role in WORKFORCE_READ_ROLES.
 * super_admin bypasses company check (reads across companies) and may
 * optionally provide ?companyId= to scope results to a specific company.
 * Returns { userId, userRecord, company, companyId }.
 */
export async function requireWorkforceRead(
  req: NextRequest
): Promise<CompanyAuthResult & { companyId: string }> {
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

  if (!WORKFORCE_READ_ROLES.includes(userRecord.role)) {
    throw forbidden("Insufficient permissions to read workforce data.");
  }

  // super_admin bypasses company check — reads across companies
  if (userRecord.role === "super_admin") {
    const queryCompanyId = req.nextUrl.searchParams.get("companyId") ?? "";
    // For super_admin, company object is a placeholder; consumers must use companyId directly
    const company = queryCompanyId
      ? await db.collection<Company>("companies").findOne({ companyId: queryCompanyId }) ?? {} as Company
      : {} as Company;

    return { userId, userRecord, company, companyId: queryCompanyId };
  }

  if (!userRecord.companyId) throw notFound("No company associated with this account.");

  const company = await db.collection<Company>("companies").findOne({ companyId: userRecord.companyId });
  if (!company) throw notFound("Company record not found.");

  if (company.status === "suspended") {
    throw forbidden("Company account is suspended. Contact support.");
  }

  if (company.status !== "approved") {
    throw forbidden(
      `Company is ${company.status}. Operational access requires an approved company.`
    );
  }

  return { userId, userRecord, company, companyId: userRecord.companyId };
}

// ─── requireWorkforceWrite ────────────────────────────────────────────────

/**
 * Requires auth + approved company + a role in WORKFORCE_WRITE_ROLES.
 * super_admin always receives HTTP 403 — no write access to company data.
 * Returns { userId, userRecord, company, companyId }.
 */
export async function requireWorkforceWrite(
  req: NextRequest
): Promise<CompanyAuthResult & { companyId: string }> {
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

  // super_admin is explicitly blocked from all write operations
  if (userRecord.role === "super_admin") {
    throw forbidden("Super Admin may not modify company workforce data.");
  }

  if (!WORKFORCE_WRITE_ROLES.includes(userRecord.role)) {
    throw forbidden("Insufficient permissions to write workforce data.");
  }

  if (!userRecord.companyId) throw notFound("No company associated with this account.");

  const company = await db.collection<Company>("companies").findOne({ companyId: userRecord.companyId });
  if (!company) throw notFound("Company record not found.");

  if (company.status === "suspended") {
    throw forbidden("Company account is suspended. Contact support.");
  }

  if (company.status !== "approved") {
    throw forbidden(
      `Company is ${company.status}. Operational access requires an approved company.`
    );
  }

  return { userId, userRecord, company, companyId: userRecord.companyId };
}

// ─── requireUserMgmt ──────────────────────────────────────────────────────

/**
 * Requires auth + approved company + company_manager or company_admin role.
 * Used exclusively on /api/workforce/users routes.
 * Returns { userId, userRecord, company, companyId }.
 */
export async function requireUserMgmt(
  req: NextRequest
): Promise<CompanyAuthResult & { companyId: string }> {
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

  if (!USER_MGMT_ROLES.includes(userRecord.role)) {
    throw forbidden("Company Manager access required.");
  }

  if (!userRecord.companyId) throw notFound("No company associated with this account.");

  const company = await db.collection<Company>("companies").findOne({ companyId: userRecord.companyId });
  if (!company) throw notFound("Company record not found.");

  if (company.status === "suspended") {
    throw forbidden("Company account is suspended. Contact support.");
  }

  if (company.status !== "approved") {
    throw forbidden(
      `Company is ${company.status}. Operational access requires an approved company.`
    );
  }

  return { userId, userRecord, company, companyId: userRecord.companyId };
}
