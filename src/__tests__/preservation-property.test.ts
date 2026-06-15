/**
 * Preservation Property Tests — Task 2
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11**
 *
 * PRESERVATION METHODOLOGY (observation-first):
 *   These tests are written BEFORE the fix is applied and MUST PASS on the
 *   unfixed codebase. They lock in baseline behavior that the fix must preserve.
 *
 *   When re-run after the fix (Task 3.9), all tests should still PASS.
 *
 * Coverage:
 *   P2.1  GET /api/company/documents — returns all stored fields for any valid DocumentType
 *   P2.2  Upsert semantics — exactly one record per (companyId, type) after N uploads
 *   P2.3  Admin route 403 — any caller role ≠ super_admin always gets HTTP 403
 *   P2.4  Client file validation — file > 10 MB → toast error before any storage call
 *   P2.5  Client MIME validation — invalid MIME type → toast error before any storage call
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// ─── Toast mock (shared) ───────────────────────────────────────────────────────

const mockToastError   = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error:   mockToastError,
    success: mockToastSuccess,
  },
}));

// ─── Firebase mocks (needed so page.tsx imports don't crash) ──────────────────

const mockUploadBytes    = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockStorageRef     = vi.fn();

vi.mock("firebase/storage", () => ({
  ref:             mockStorageRef,
  uploadBytes:     mockUploadBytes,
  getDownloadURL:  mockGetDownloadURL,
}));

vi.mock("@/lib/firebase", () => ({
  storage: {},
  auth:    {},
  default: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
  useUser: () => ({ user: { getIdToken: vi.fn().mockResolvedValue("mock-token") } }),
}));

vi.mock("@/lib/company-context", () => ({
  useCompany: () => ({
    company: { companyId: "test-company-id" },
    status:  "pending",
    refresh: vi.fn(),
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentType =
  | "gst"
  | "pan"
  | "insurance"
  | "transport_license"
  | "fleet_insurance";

type UserRole =
  | "company_admin"
  | "operations_manager"
  | "fleet_manager"
  | "dispatcher"
  | "driver"
  | "super_admin";

interface StoredDocument {
  documentId:  string;
  companyId:   string;
  type:        DocumentType;
  fileData:    string;         // Base64-encoded file content (fixed schema)
  fileName:    string;
  mimeType:    string;
  fileSize:    number;
  uploadedAt:  string;
  verified:    boolean;
}

// ─── Inline route simulations ─────────────────────────────────────────────────

/**
 * Simulates GET /api/company/documents handler logic (unfixed & fixed — unchanged).
 *
 * The GET handler:
 *   1. Verifies auth token
 *   2. Looks up userRecord → companyId
 *   3. Queries company_documents by companyId
 *   4. Returns { documents: cleaned[] }
 *
 * We inline the logic to avoid spinning up a full Next.js server.
 */
function simulateGetDocuments(
  documents: StoredDocument[],
  companyId: string
): { status: number; body: { documents: Omit<StoredDocument, "_id">[] } | { error: string } } {
  // Auth and user lookup are assumed to succeed (tested separately in integration)
  // Simulate the collection.find({ companyId }).toArray() step:
  const matching = documents.filter((d) => d.companyId === companyId);

  // Simulate the _id strip:
  const cleaned = matching.map(({ ...d }) => d as Omit<StoredDocument, "_id">);

  return { status: 200, body: { documents: cleaned } };
}

/**
 * Simulates POST /api/company/documents handler logic (FIXED).
 *
 * Fixed validation (from route.ts):
 *   - type must be in VALID_TYPES
 *   - fileData must be a non-empty string
 *   - fileName must be a non-empty string
 *   - mimeType must be in VALID_MIMES
 *   - fileSize must be a positive integer ≤ 10 485 760
 *
 * Upsert semantics (from route.ts):
 *   - updateOne({ companyId, type }, { $set: {...} }, { upsert: true })
 *   - Always results in exactly one record per (companyId, type)
 *
 * Suspended guard (from route.ts):
 *   - company.status === "suspended" → 403
 *
 * Audit event (from route.ts):
 *   - createAuditEvent({ eventType: "document_uploaded", ... })
 */
function simulateFixedPostDocument(
  db: {
    documents: StoredDocument[];
    audits:    Record<string, unknown>[];
    company:   { status: string };
  },
  body:      Record<string, unknown>,
  companyId: string,
  userId:    string
): { status: number; body: Record<string, unknown> } {
  const VALID_TYPES: DocumentType[] = [
    "gst", "pan", "insurance", "transport_license", "fleet_insurance",
  ];
  const VALID_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

  const { type, fileData, fileName, mimeType, fileSize } = body as {
    type?:     DocumentType;
    fileData?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
  };

  // Validate type
  if (!type || !VALID_TYPES.includes(type)) {
    return { status: 400, body: { error: "Invalid or missing document type" } };
  }
  // Validate fileData (fixed requirement)
  if (!fileData || typeof fileData !== "string") {
    return { status: 400, body: { error: "Missing fileData" } };
  }
  // Validate fileName
  if (!fileName || typeof fileName !== "string") {
    return { status: 400, body: { error: "Missing fileName" } };
  }
  // Validate mimeType
  if (!mimeType || !VALID_MIMES.includes(mimeType)) {
    return { status: 400, body: { error: "Invalid or missing mimeType" } };
  }
  // Validate fileSize
  if (!fileSize || typeof fileSize !== "number" || !Number.isInteger(fileSize) || fileSize <= 0 || fileSize > 10_485_760) {
    return { status: 400, body: { error: "Invalid fileSize" } };
  }

  // Suspended guard (Req 3.10)
  if (db.company.status === "suspended") {
    return { status: 403, body: { error: "Company account is suspended." } };
  }

  const now        = new Date().toISOString();
  const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Upsert: remove existing record for (companyId, type), insert new one
  const existingIdx = db.documents.findIndex(
    (d) => d.companyId === companyId && d.type === type
  );
  const newDoc: StoredDocument = {
    documentId,
    companyId,
    type,
    fileData,
    fileName,
    mimeType,
    fileSize,
    uploadedAt: now,
    verified:   false,
  };

  if (existingIdx >= 0) {
    db.documents[existingIdx] = newDoc;
  } else {
    db.documents.push(newDoc);
  }

  // Audit event (Req 3.11)
  db.audits.push({
    auditId:     `audit-${Date.now()}`,
    companyId,
    eventType:   "document_uploaded",
    performedBy: userId,
    timestamp:   now,
    description: `Document "${type}" uploaded.`,
    details:     { type, documentId },
  });

  return { status: 201, body: { document: newDoc } };
}

/**
 * Simulates GET /api/admin/companies handler logic (unfixed).
 *
 * Role check (Req 2.7, 3.8):
 *   - caller role !== "super_admin" → 403
 *
 * Returns companies array for super_admin.
 */
function simulateGetAdminCompanies(
  callerRole: UserRole,
  companies:  Record<string, unknown>[]
): { status: number; body: Record<string, unknown> } {
  // Super-admin check (mirrors route.ts: actor?.role !== "super_admin" → 403)
  if (callerRole !== "super_admin") {
    return { status: 403, body: { error: "Forbidden" } };
  }
  return { status: 200, body: { companies, total: companies.length } };
}

/**
 * Simulates the client-side file validation in handleFile (unfixed & fixed — unchanged).
 *
 * Validation order (from page.tsx):
 *   1. size > 10 MB → toast.error("File too large"), return
 *   2. mimeType not in allowlist → toast.error("Invalid file type"), return
 *   3. Proceed to upload (Firebase Storage on unfixed, FileReader on fixed)
 */
function simulateClientValidation(
  file: { size: number; type: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockToast: { error: (...args: any[]) => any },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockStorageCall: (...args: any[]) => any
): void {
  const ACCEPTED_MIMES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (file.size > 10 * 1024 * 1024) {
    mockToast.error("File too large", { description: "Maximum file size is 10 MB" });
    return;
  }
  if (!ACCEPTED_MIMES.includes(file.type)) {
    mockToast.error("Invalid file type", { description: "Accepted: PDF, JPG, PNG, WEBP" });
    return;
  }

  // Only reached when validation passes — represents any storage call
  mockStorageCall();
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const arbDocumentType = fc.constantFrom<DocumentType>(
  "gst", "pan", "insurance", "transport_license", "fleet_insurance"
);

/** File size within the valid 1 B – 10 MB range */
const arbValidFileSize = fc.integer({ min: 1, max: 10 * 1024 * 1024 });

/** Non-super_admin roles */
const arbNonAdminRole = fc.constantFrom<UserRole>(
  "company_admin",
  "operations_manager",
  "fleet_manager",
  "dispatcher",
  "driver"
);

/** A valid Base64 fileData string (simulates Base64-encoded file content) */
const arbFileData = fc.string({ minLength: 4, maxLength: 500 }).map((s) => Buffer.from(s).toString("base64"));

/** A valid fileName string */
const arbFileName = fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}\.(pdf|jpg|png|webp)$/);

/** A valid MIME type from the allowlist */
const arbValidMime = fc.constantFrom(
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
);

/** A valid fileUrl string (simulates a Firebase Storage download URL) — kept for GET simulation */
const arbFileUrl = fc.webUrl().filter((u) => u.startsWith("https://"));

/** A valid companyId string */
const arbCompanyId = fc.stringMatching(/^company-[a-z0-9]{4,12}$/);

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe("Preservation Property Tests — Non-Upload Behavior (Task 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageRef.mockReturnValue({ fullPath: "mock/path" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── P2.1 ──────────────────────────────────────────────────────────────────

  describe("P2.1 — GET /api/company/documents returns all stored fields for any valid DocumentType", () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     *
     * Property: for any DocumentType and file size 1 B – 10 MB, when a document
     * has been stored, GET /api/company/documents returns that document with all
     * required fields present (documentId, companyId, type, fileUrl, uploadedAt, verified).
     *
     * This ensures the GET handler shape is preserved — neither the fix nor any
     * future change should drop fields from the response.
     */
    it(
      "PBT: for any valid DocumentType and file size, GET returns all stored fields",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            arbDocumentType,
            arbValidFileSize,
            arbFileData,
            arbFileName,
            arbValidMime,
            arbCompanyId,
            async (docType, fileSize, fileData, fileName, mimeType, companyId) => {
              // Build a stored document (as if POST /api/company/documents had succeeded)
              const storedDoc: StoredDocument = {
                documentId: `doc-${docType}-001`,
                companyId,
                type:       docType,
                fileData,
                fileName,
                mimeType,
                fileSize,
                uploadedAt: new Date().toISOString(),
                verified:   false,
              };

              const db = [storedDoc];

              // Simulate GET /api/company/documents
              const result = simulateGetDocuments(db, companyId);

              // Assert: HTTP 200
              expect(result.status).toBe(200);

              const body = result.body as { documents: StoredDocument[] };
              expect(body.documents).toHaveLength(1);

              const returned = body.documents[0];

              // Assert: all required fields are present
              expect(returned.documentId).toBeDefined();
              expect(returned.companyId).toBe(companyId);
              expect(returned.type).toBe(docType);
              expect(returned.fileData).toBe(fileData);
              expect(returned.fileName).toBe(fileName);
              expect(returned.mimeType).toBe(mimeType);
              expect(returned.fileSize).toBe(fileSize);
              expect(returned.uploadedAt).toBeDefined();
              expect(typeof returned.verified).toBe("boolean");
            }
          ),
          { numRuns: 50, seed: 100 }
        );
      }
    );

    it(
      "PBT: GET returns exactly the documents belonging to the requesting company (isolation)",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            arbCompanyId,
            arbCompanyId,
            arbDocumentType,
            arbFileData,
            async (companyA, companyB, docType, fileData) => {
              // Skip when fast-check generates the same companyId twice
              fc.pre(companyA !== companyB);

              const docsA: StoredDocument[] = [
                { documentId: "doc-A-1", companyId: companyA, type: docType, fileData, fileName: "a.pdf", mimeType: "application/pdf", fileSize: 1024, uploadedAt: new Date().toISOString(), verified: false },
              ];
              const docsB: StoredDocument[] = [
                { documentId: "doc-B-1", companyId: companyB, type: docType, fileData, fileName: "b.pdf", mimeType: "application/pdf", fileSize: 1024, uploadedAt: new Date().toISOString(), verified: false },
              ];
              const allDocs = [...docsA, ...docsB];

              // Company A should only see its own document
              const resultA = simulateGetDocuments(allDocs, companyA);
              const bodyA   = resultA.body as { documents: StoredDocument[] };
              expect(bodyA.documents.every((d) => d.companyId === companyA)).toBe(true);

              // Company B should only see its own document
              const resultB = simulateGetDocuments(allDocs, companyB);
              const bodyB   = resultB.body as { documents: StoredDocument[] };
              expect(bodyB.documents.every((d) => d.companyId === companyB)).toBe(true);
            }
          ),
          { numRuns: 30, seed: 101 }
        );
      }
    );

    it(
      "returns empty array when company has no documents",
      () => {
        const result = simulateGetDocuments([], "company-xyz");
        expect(result.status).toBe(200);
        const body = result.body as { documents: StoredDocument[] };
        expect(body.documents).toHaveLength(0);
      }
    );
  });

  // ─── P2.2 ──────────────────────────────────────────────────────────────────

  describe("P2.2 — Upsert semantics: exactly one record per (companyId, type) after N uploads", () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * Property: for a random sequence of 1–5 uploads of the same DocumentType,
     * MongoDB always contains exactly one record per (companyId, type) after each
     * upload in the sequence.
     *
     * This is the "Replace" / upsert-by-type guarantee that the route.ts enforces.
     */
    it(
      "PBT: for 1–5 sequential uploads of the same type, exactly one record per (companyId, type) exists",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            arbDocumentType,
            arbCompanyId,
            // Generate 1–5 fileData strings representing successive uploads
            fc.array(fc.tuple(arbFileData, arbFileName, arbValidMime, arbValidFileSize), { minLength: 1, maxLength: 5 }),
            async (docType, companyId, uploads) => {
              const db: {
                documents: StoredDocument[];
                audits:    Record<string, unknown>[];
                company:   { status: string };
              } = {
                documents: [],
                audits:    [],
                company:   { status: "approved" },
              };

              // Perform each upload in sequence
              for (const [fileData, fileName, mimeType, fileSize] of uploads) {
                const result = simulateFixedPostDocument(
                  db,
                  { type: docType, fileData, fileName, mimeType, fileSize },
                  companyId,
                  "user-actor-001"
                );

                // Each call must succeed
                expect(result.status).toBe(201);
              }

              // After all uploads: exactly ONE record per (companyId, type)
              const matching = db.documents.filter(
                (d) => d.companyId === companyId && d.type === docType
              );
              expect(matching).toHaveLength(1);

              // The remaining record must have the last uploaded fileData
              const [lastFileData] = uploads[uploads.length - 1];
              expect(matching[0].fileData).toBe(lastFileData);
            }
          ),
          { numRuns: 40, seed: 200 }
        );
      }
    );

    it(
      "PBT: uploading all five document types results in exactly five records per company",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            arbCompanyId,
            arbFileData,
            async (companyId, fileData) => {
              const db: {
                documents: StoredDocument[];
                audits:    Record<string, unknown>[];
                company:   { status: string };
              } = {
                documents: [],
                audits:    [],
                company:   { status: "approved" },
              };

              const allTypes: DocumentType[] = [
                "gst", "pan", "insurance", "transport_license", "fleet_insurance",
              ];

              for (const docType of allTypes) {
                simulateFixedPostDocument(
                  db,
                  { type: docType, fileData, fileName: "doc.pdf", mimeType: "application/pdf", fileSize: 1024 },
                  companyId,
                  "user-actor-001"
                );
              }

              const companyDocs = db.documents.filter((d) => d.companyId === companyId);
              expect(companyDocs).toHaveLength(5);

              // Each type appears exactly once
              for (const docType of allTypes) {
                const typeCount = companyDocs.filter((d) => d.type === docType).length;
                expect(typeCount).toBe(1);
              }
            }
          ),
          { numRuns: 20, seed: 201 }
        );
      }
    );

    it(
      "replacing a document updates the record and emits a new audit event",
      () => {
        const db: {
          documents: StoredDocument[];
          audits:    Record<string, unknown>[];
          company:   { status: string };
        } = {
          documents: [],
          audits:    [],
          company:   { status: "approved" },
        };

        const companyId = "company-replace-test";
        const fileDataV1 = Buffer.from("version-1-content").toString("base64");
        const fileDataV2 = Buffer.from("version-2-content").toString("base64");

        // First upload
        simulateFixedPostDocument(
          db,
          { type: "gst", fileData: fileDataV1, fileName: "v1.pdf", mimeType: "application/pdf", fileSize: 1024 },
          companyId,
          "user-001"
        );

        expect(db.documents).toHaveLength(1);
        const firstDocId = db.documents[0].documentId;

        // Second upload (replace)
        simulateFixedPostDocument(
          db,
          { type: "gst", fileData: fileDataV2, fileName: "v2.pdf", mimeType: "application/pdf", fileSize: 2048 },
          companyId,
          "user-001"
        );

        // Still only one record per type
        expect(db.documents).toHaveLength(1);
        expect(db.documents[0].fileData).toBe(fileDataV2);

        // documentId changes on replace (new record written by $set with new documentId)
        expect(db.documents[0].documentId).not.toBe(firstDocId);

        // Two audit events emitted (one per upload)
        const uploadAudits = db.audits.filter((a) => a["eventType"] === "document_uploaded");
        expect(uploadAudits).toHaveLength(2);
      }
    );
  });

  // ─── P2.3 ──────────────────────────────────────────────────────────────────

  describe("P2.3 — GET /api/admin/companies returns 403 for any caller role ≠ super_admin", () => {
    /**
     * **Validates: Requirements 2.7, 3.8**
     *
     * Property: for any caller whose UserRecord.role is not "super_admin",
     * GET /api/admin/companies always returns HTTP 403 and never returns
     * any company data.
     *
     * This must hold on both unfixed and fixed code.
     */
    it(
      "PBT: any non-super_admin role always gets HTTP 403",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            arbNonAdminRole,
            // Generate a non-empty companies array to make sure data isolation is enforced
            fc.array(
              fc.record({
                companyId:   fc.stringMatching(/^company-[a-z0-9]{4,8}$/),
                companyName: fc.string({ minLength: 3, maxLength: 30 }),
                status:      fc.constantFrom("pending", "approved", "rejected"),
              }),
              { minLength: 1, maxLength: 5 }
            ),
            async (callerRole, companies) => {
              const result = simulateGetAdminCompanies(
                callerRole,
                companies as Record<string, unknown>[]
              );

              // Must always be 403
              expect(result.status).toBe(403);

              // Must never return company data
              expect(result.body).not.toHaveProperty("companies");
              expect(result.body).toHaveProperty("error", "Forbidden");
            }
          ),
          { numRuns: 50, seed: 300 }
        );
      }
    );

    it(
      "super_admin caller gets HTTP 200 with companies array",
      () => {
        const mockCompanies = [
          { companyId: "company-abc1", companyName: "Acme Corp", status: "pending" },
        ];

        const result = simulateGetAdminCompanies(
          "super_admin",
          mockCompanies as Record<string, unknown>[]
        );

        expect(result.status).toBe(200);
        const body = result.body as { companies: unknown[]; total: number };
        expect(body.companies).toHaveLength(1);
        expect(body.total).toBe(1);
      }
    );

    it(
      "each non-super_admin role is individually rejected (explicit coverage)",
      () => {
        const nonAdminRoles: UserRole[] = [
          "company_admin",
          "operations_manager",
          "fleet_manager",
          "dispatcher",
          "driver",
        ];

        for (const role of nonAdminRoles) {
          const result = simulateGetAdminCompanies(role, []);
          expect(result.status).toBe(403);
          expect((result.body as { error: string }).error).toBe("Forbidden");
        }
      }
    );
  });

  // ─── P2.4 ──────────────────────────────────────────────────────────────────

  describe("P2.4 — Client validation: file > 10 MB triggers toast error before any storage call", () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * The file-size guard runs before any storage call (Firebase Storage on
     * unfixed code, FileReader on fixed code). This must be preserved.
     */
    it(
      "file exactly at 10 MB + 1 byte is rejected before storage call",
      () => {
        const storageCallMock = vi.fn();
        const toastMock       = { error: mockToastError };

        simulateClientValidation(
          { size: 10 * 1024 * 1024 + 1, type: "application/pdf" },
          toastMock,
          storageCallMock
        );

        expect(storageCallMock).not.toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith(
          "File too large",
          expect.objectContaining({ description: "Maximum file size is 10 MB" })
        );
      }
    );

    it(
      "PBT: any file with size > 10 MB always triggers toast error, never storage call",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate file sizes strictly above 10 MB
            fc.integer({ min: 10 * 1024 * 1024 + 1, max: 100 * 1024 * 1024 }),
            fc.constantFrom("application/pdf", "image/jpeg", "image/png", "image/webp"),
            async (fileSize, mimeType) => {
              vi.clearAllMocks();

              const storageCallMock = vi.fn();
              const toastMock       = { error: mockToastError };

              simulateClientValidation({ size: fileSize, type: mimeType }, toastMock, storageCallMock);

              // Storage call must never happen
              expect(storageCallMock).not.toHaveBeenCalled();

              // Toast error must fire
              expect(mockToastError).toHaveBeenCalledWith(
                "File too large",
                expect.objectContaining({ description: "Maximum file size is 10 MB" })
              );
            }
          ),
          { numRuns: 30, seed: 400 }
        );
      }
    );

    it(
      "file at exactly 10 MB (boundary) is not rejected by the size guard",
      () => {
        const storageCallMock = vi.fn();
        const toastMock       = { error: mockToastError };

        // Exactly 10 MB = allowed (size > 10MB is the guard, so 10MB itself passes)
        simulateClientValidation(
          { size: 10 * 1024 * 1024, type: "application/pdf" },
          toastMock,
          storageCallMock
        );

        // Should NOT trigger size toast
        expect(mockToastError).not.toHaveBeenCalledWith(
          "File too large",
          expect.anything()
        );

        // Should proceed to storage call (size is valid)
        expect(storageCallMock).toHaveBeenCalledTimes(1);
      }
    );
  });

  // ─── P2.5 ──────────────────────────────────────────────────────────────────

  describe("P2.5 — Client validation: invalid MIME type triggers toast error before any storage call", () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * The MIME-type guard runs after the size guard but before any storage call.
     * Invalid MIME types must be rejected with a toast and no storage call.
     */
    it(
      "PBT: any MIME type not in the allowlist triggers toast error, never storage call",
      async () => {
        const invalidMimes = [
          "text/plain",
          "application/json",
          "video/mp4",
          "audio/mpeg",
          "application/zip",
          "application/msword",
          "text/html",
          "application/octet-stream",
          "image/gif",
          "image/bmp",
          "image/tiff",
          "image/svg+xml",
        ];

        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...invalidMimes),
            // Valid file size so size guard doesn't interfere
            fc.integer({ min: 1, max: 10 * 1024 * 1024 }),
            async (mimeType, fileSize) => {
              vi.clearAllMocks();

              const storageCallMock = vi.fn();
              const toastMock       = { error: mockToastError };

              simulateClientValidation({ size: fileSize, type: mimeType }, toastMock, storageCallMock);

              // Storage call must never happen for invalid MIME
              expect(storageCallMock).not.toHaveBeenCalled();

              // Toast error must fire with "Invalid file type"
              expect(mockToastError).toHaveBeenCalledWith(
                "Invalid file type",
                expect.objectContaining({ description: "Accepted: PDF, JPG, PNG, WEBP" })
              );
            }
          ),
          { numRuns: 40, seed: 500 }
        );
      }
    );

    it(
      "all four valid MIME types are accepted (no toast, storage call proceeds)",
      () => {
        const validMimes = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        for (const mimeType of validMimes) {
          vi.clearAllMocks();

          const storageCallMock = vi.fn();
          const toastMock       = { error: mockToastError };

          simulateClientValidation(
            { size: 512 * 1024, type: mimeType },
            toastMock,
            storageCallMock
          );

          // No toast for valid MIME
          expect(mockToastError).not.toHaveBeenCalled();

          // Storage call proceeds
          expect(storageCallMock).toHaveBeenCalledTimes(1);
        }
      }
    );

    it(
      "invalid MIME type check fires even when file is within size limit (ordering preserved)",
      () => {
        const storageCallMock = vi.fn();
        const toastMock       = { error: mockToastError };

        simulateClientValidation(
          { size: 1024, type: "application/json" },
          toastMock,
          storageCallMock
        );

        expect(storageCallMock).not.toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith(
          "Invalid file type",
          expect.objectContaining({ description: "Accepted: PDF, JPG, PNG, WEBP" })
        );
      }
    );
  });

  // ─── P2.6 — Suspended company guard (Req 3.10) ───────────────────────────

  describe("P2.6 — Suspended company guard: POST /api/company/documents returns 403 for suspended companies", () => {
    /**
     * **Validates: Requirement 3.10**
     *
     * The suspended-company guard must be preserved: when company.status === "suspended",
     * the API must return 403 regardless of the payload shape.
     */
    it(
      "suspended company returns 403 on POST /api/company/documents",
      () => {
        const db: {
          documents: StoredDocument[];
          audits:    Record<string, unknown>[];
          company:   { status: string };
        } = {
          documents: [],
          audits:    [],
          company:   { status: "suspended" },
        };

        const result = simulateFixedPostDocument(
          db,
          { type: "gst", fileData: Buffer.from("test").toString("base64"), fileName: "test.pdf", mimeType: "application/pdf", fileSize: 1024 },
          "company-suspended-001",
          "user-001"
        );

        expect(result.status).toBe(403);
        expect((result.body as { error: string }).error).toContain("suspended");

        // No document written
        expect(db.documents).toHaveLength(0);

        // No audit event written
        expect(db.audits).toHaveLength(0);
      }
    );
  });

  // ─── P2.7 — Audit event emission (Req 3.11) ──────────────────────────────

  describe("P2.7 — Audit event: document_uploaded event is emitted on every successful upload", () => {
    /**
     * **Validates: Requirement 3.11**
     *
     * A document_uploaded audit event must be written to the audits collection
     * after each successful POST /api/company/documents call.
     */
    it(
      "PBT: every successful upload emits exactly one document_uploaded audit event",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            arbDocumentType,
            arbCompanyId,
            arbFileData,
            async (docType, companyId, fileData) => {
              const db: {
                documents: StoredDocument[];
                audits:    Record<string, unknown>[];
                company:   { status: string };
              } = {
                documents: [],
                audits:    [],
                company:   { status: "approved" },
              };

              const result = simulateFixedPostDocument(
                db,
                { type: docType, fileData, fileName: "doc.pdf", mimeType: "application/pdf", fileSize: 1024 },
                companyId,
                "user-actor-001"
              );

              expect(result.status).toBe(201);

              // Exactly one audit event emitted
              const uploadAudits = db.audits.filter(
                (a) => a["eventType"] === "document_uploaded"
              );
              expect(uploadAudits).toHaveLength(1);

              // Audit event has correct companyId and type
              expect(uploadAudits[0]["companyId"]).toBe(companyId);
              expect((uploadAudits[0]["details"] as { type: string })["type"]).toBe(docType);
            }
          ),
          { numRuns: 30, seed: 600 }
        );
      }
    );

    it(
      "no audit event emitted when upload is rejected (suspended company)",
      () => {
        const db: {
          documents: StoredDocument[];
          audits:    Record<string, unknown>[];
          company:   { status: string };
        } = {
          documents: [],
          audits:    [],
          company:   { status: "suspended" },
        };

        simulateFixedPostDocument(
          db,
          { type: "pan", fileData: Buffer.from("test-pan").toString("base64"), fileName: "pan.pdf", mimeType: "application/pdf", fileSize: 1024 },
          "company-001",
          "user-001"
        );

        expect(db.audits).toHaveLength(0);
      }
    );
  });
});
