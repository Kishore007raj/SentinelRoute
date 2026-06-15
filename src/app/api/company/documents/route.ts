import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { CompanyDocument, DocumentType, UserRecord, Company } from "@/lib/types";
import { createAuditEvent } from "@/lib/audit";

const VALID_TYPES: DocumentType[] = [
  "gst",
  "pan",
  "insurance",
  "transport_license",
  "fleet_insurance",
];

/**
 * GET /api/company/documents
 * Returns all documents for the authenticated user's company.
 *
 * POST /api/company/documents
 * Upserts a document record (insert or replace by type).
 * Body: { type: DocumentType, fileData: string, fileName: string, mimeType: string, fileSize: number }
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
    const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
    if (!userRecord?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const docs = await db
      .collection<CompanyDocument>("company_documents")
      .find({ companyId: userRecord.companyId })
      .toArray();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cleaned = docs.map(({ _id, ...d }: CompanyDocument & { _id: unknown }) => d);
    return NextResponse.json({ documents: cleaned });
  } catch (err) {
    console.error("[GET /api/company/documents]", err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
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

  const { type, fileData, fileName, mimeType, fileSize } = body as {
    type?:     DocumentType;
    fileData?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
  };

  const VALID_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid or missing document type" }, { status: 400 });
  }
  if (!fileData || typeof fileData !== "string") {
    return NextResponse.json({ error: "Missing fileData" }, { status: 400 });
  }
  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "Missing fileName" }, { status: 400 });
  }
  if (!mimeType || !VALID_MIMES.includes(mimeType)) {
    return NextResponse.json({ error: "Invalid or missing mimeType" }, { status: 400 });
  }
  if (!fileSize || typeof fileSize !== "number" || !Number.isInteger(fileSize) || fileSize <= 0 || fileSize > 10_485_760) {
    return NextResponse.json({ error: "Invalid fileSize" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
    if (!userRecord?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Task 6: block suspended companies from uploading documents
    const company = await db.collection<Company>("companies").findOne({ companyId: userRecord.companyId });
    if (company?.status === "suspended") {
      return NextResponse.json({ error: "Company account is suspended." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Upsert by (companyId + type)
    await db.collection("company_documents").updateOne(
      { companyId: userRecord.companyId, type },
      {
        $set: {
          documentId,
          companyId: userRecord.companyId,
          type,
          fileName,
          mimeType,
          fileSize,
          fileData,
          uploadedAt: now,
          verified:   false,
        },
      },
      { upsert: true }
    );

    const doc = await db.collection<CompanyDocument>("company_documents").findOne({
      companyId: userRecord.companyId,
      type,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...cleaned } = doc as CompanyDocument & { _id: unknown };

    // Task 3: canonical audit event
    await createAuditEvent({
      db,
      companyId:   userRecord.companyId,
      eventType:   "document_uploaded",
      performedBy: userId,
      description: `Document "${type}" uploaded.`,
      details:     { type, documentId },
    });

    return NextResponse.json({ document: cleaned }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/company/documents]", err);
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
  }
}
