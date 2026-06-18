import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { Company, UserRecord } from "@/lib/types";
import { createDefaultCompanySettings } from "@/lib/company-settings";
import { createAuditEvent } from "@/lib/audit";

/**
 * POST /api/company/register
 *
 * Creates a Company record + UserRecord (company_admin) for the authenticated user.
 * Also creates: company_settings (Task 2) and audit event (Task 3).
 * Idempotent: if user already has a company, returns it.
 */
export async function POST(req: NextRequest) {
  let userId: string;
  let userEmail: string | undefined;

  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
    // Get user email from Firebase token claims if available
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

  // Validate required fields
  const required = ["companyName", "companyType", "gstNumber", "panNumber", "email", "phone", "address"];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== "string") {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  try {
    const db = await getDb();

    // Idempotency check
    const existing = await db.collection<UserRecord>("users").findOne({ userId });
    if (existing?.companyId) {
      const co = await db.collection<Company>("companies").findOne({ companyId: existing.companyId });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id: _a, ...ur } = existing as typeof existing & { _id: unknown };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id: _b, ...coClean } = (co ?? {}) as Record<string, unknown>;
      return NextResponse.json({ userRecord: ur, company: coClean }, { status: 200 });
    }

    const now = new Date().toISOString();
    const companyId = `co-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const company: Company = {
      companyId,
      companyName:     String(body.companyName),
      companyType:     String(body.companyType),
      gstNumber:       String(body.gstNumber),
      panNumber:       String(body.panNumber),
      website:         String(body.website ?? ""),
      email:           String(body.email),
      phone:           String(body.phone),
      address:         String(body.address),
      fleetSize:       Number(body.fleetSize ?? 0),
      operatingStates: Array.isArray(body.operatingStates) ? (body.operatingStates as string[]) : [],
      cargoCategories: Array.isArray(body.cargoCategories) ? (body.cargoCategories as string[]) : [],
      status:          "pending",
      // Trust metrics — initialized to defaults
      trustScore:         100,
      completedShipments: 0,
      delayedShipments:   0,
      incidentCount:      0,
      auditFlags:         0,
      // Multilingual defaults
      preferredLanguage:  "en",
      supportedLanguages: ["en"],
      fallbackLanguage:   "en",
      createdAt:       now,
    };

    const userRecord: UserRecord = {
      userId,
      companyId,
      name:      String(body.contactName ?? userEmail ?? userId),
      email:     String(body.email),
      role:      "company_admin",
      active:    true,
      createdAt: now,
    };

    await db.collection("companies").insertOne(company);
    await db.collection("users").insertOne(userRecord);

    // Task 2: create default company_settings automatically
    await createDefaultCompanySettings(db, companyId);

    // Task 3: canonical audit event
    await createAuditEvent({
      db,
      companyId,
      eventType:   "company_registered",
      performedBy: userId,
      description: `Company "${company.companyName}" registered. Status: pending.`,
      details:     { companyName: company.companyName, companyType: company.companyType },
    });

    return NextResponse.json({ userRecord, company }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/company/register]", err);
    return NextResponse.json({ error: "Failed to register company" }, { status: 500 });
  }
}
