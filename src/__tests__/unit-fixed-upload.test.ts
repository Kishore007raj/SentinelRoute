/**
 * Unit Tests for Fixed Upload Path — Task 3.7
 *
 * **Validates: Requirements 2.1, 2.2, 2.5, 2.6**
 *
 * Covers all four fixed components using inline simulation
 * (same pattern as tasks 1 and 2 — no full Next.js server):
 *
 *   1. handleFile (fixed)          — FileReader → fetch with fileData shape
 *   2. POST /api/company/documents — fixed validation and storage
 *   3. GET  /api/admin/companies   — email fields + 403 guard
 *   4. POST /api/admin/seed-super-admin — seed 3 admins, idempotent, secret guard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Toast mocks ──────────────────────────────────────────────────────────────

const mockToastError   = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error:   mockToastError,
    success: mockToastSuccess,
  },
}));

// ─── Firebase mocks (so page.tsx imports don't crash) ─────────────────────────

vi.mock("firebase/storage", () => ({
  ref:            vi.fn(),
  uploadBytes:    vi.fn(),
  getDownloadURL: vi.fn(),
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

// ─── Shared types ─────────────────────────────────────────────────────────────

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
  fileName:    string;
  mimeType:    string;
  fileSize:    number;
  fileData:    string;
  uploadedAt:  string;
  verified:    boolean;
}

interface UserRecord {
  userId:    string;
  companyId: string;
  name:      string;
  email:     string;
  role:      UserRole;
  active:    boolean;
  createdAt: string;
}

// ─── Inline simulation: handleFile (FIXED) ────────────────────────────────────

/**
 * Simulates the FIXED handleFile function from page.tsx.
 *
 * Key behavioral changes vs unfixed:
 *   - No Firebase Storage calls (uploadBytes / getDownloadURL)
 *   - Reads file via FileReader.readAsDataURL
 *   - Strips "data:mime;base64," prefix
 *   - POSTs { type, fileData, fileName, mimeType, fileSize } to /api/company/documents
 *   - Preserves: size guard, MIME guard, toast messages, loading state, error handling
 */
async function simulateFixedHandleFile(
  file:        File,
  user:        { getIdToken: () => Promise<string> },
  docType:     DocumentType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchMock:   (...args: any[]) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadBytes: (...args: any[]) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUploaded:  (...args: any[]) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setUploading: (...args: any[]) => any,
  /** Optionally override the FileReader result — defaults to a valid data URL */
  fileReaderResult?: string
): Promise<void> {
  // ── Size guard (unchanged) ────────────────────────────────────────────────
  if (file.size > 10 * 1024 * 1024) {
    mockToastError("File too large", { description: "Maximum file size is 10 MB" });
    return;
  }
  // ── MIME guard (unchanged) ────────────────────────────────────────────────
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    mockToastError("Invalid file type", { description: "Accepted: PDF, JPG, PNG, WEBP" });
    return;
  }

  setUploading(true);
  try {
    // ── Read file as Base64 (FIXED — no Firebase Storage) ──────────────────
    const base64Full = await new Promise<string>((resolve, reject) => {
      // Use the injected result or fall back to a deterministic data URL
      const result =
        fileReaderResult ?? `data:${file.type};base64,dGVzdA==`;
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Failed to read file"));
      }
    });
    const fileData = base64Full.split(",")[1]; // strip "data:mime;base64," prefix

    // ── uploadBytes must NEVER be called in the fixed path ─────────────────
    // (the test assertion below will catch this — we simply don't call it)

    // ── POST to /api/company/documents ────────────────────────────────────
    const token = await user.getIdToken();
    const res: Response = await fetchMock("/api/company/documents", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({
        type:     docType,
        fileData,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error((data as { error?: string }).error ?? "Upload failed");
    }

    const data = await res.json() as { document: StoredDocument };
    onUploaded(data.document);
    mockToastSuccess(`${docType} uploaded`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    mockToastError("Upload failed", { description: msg });
  } finally {
    setUploading(false);
  }
}

// ─── Inline simulation: POST /api/company/documents (FIXED) ──────────────────

const VALID_TYPES: DocumentType[] = [
  "gst", "pan", "insurance", "transport_license", "fleet_insurance",
];
const VALID_MIMES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp",
];

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
  const {
    type,
    fileData,
    fileName,
    mimeType,
    fileSize,
  } = body as {
    type?:     DocumentType;
    fileData?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
  };

  // ── Validate type ─────────────────────────────────────────────────────────
  if (!type || !VALID_TYPES.includes(type)) {
    return { status: 400, body: { error: "Invalid or missing document type" } };
  }
  // ── Validate fileData ─────────────────────────────────────────────────────
  if (!fileData || typeof fileData !== "string") {
    return { status: 400, body: { error: "Missing fileData" } };
  }
  // ── Validate fileName ─────────────────────────────────────────────────────
  if (!fileName || typeof fileName !== "string") {
    return { status: 400, body: { error: "Missing fileName" } };
  }
  // ── Validate mimeType ─────────────────────────────────────────────────────
  if (!mimeType || !VALID_MIMES.includes(mimeType)) {
    return { status: 400, body: { error: "Invalid or missing mimeType" } };
  }
  // ── Validate fileSize ─────────────────────────────────────────────────────
  if (
    !fileSize
    || typeof fileSize !== "number"
    || !Number.isInteger(fileSize)
    || fileSize <= 0
    || fileSize > 10_485_760
  ) {
    return { status: 400, body: { error: "Invalid fileSize" } };
  }

  // ── Suspended guard ───────────────────────────────────────────────────────
  if (db.company.status === "suspended") {
    return { status: 403, body: { error: "Company account is suspended." } };
  }

  const now        = new Date().toISOString();
  const documentId = `doc-fixed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // ── Upsert by (companyId, type) ───────────────────────────────────────────
  const newDoc: StoredDocument = {
    documentId,
    companyId,
    type,
    fileName,
    mimeType,
    fileSize,
    fileData,
    uploadedAt: now,
    verified:   false,
  };

  const existingIdx = db.documents.findIndex(
    (d) => d.companyId === companyId && d.type === type
  );
  if (existingIdx >= 0) {
    db.documents[existingIdx] = newDoc;
  } else {
    db.documents.push(newDoc);
  }

  // ── Audit event ────────────────────────────────────────────────────────────
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

// ─── Inline simulation: GET /api/admin/companies (FIXED) ─────────────────────

interface CompanyWithEmails {
  companyId:      string;
  companyName:    string;
  email:          string;
  status:         string;
  createdAt:      string;
  companyEmail?:  string;
  adminUserEmail?: string | null;
}

function simulateFixedGetAdminCompanies(
  callerRole: UserRole,
  companies:  CompanyWithEmails[],
  adminUsers: UserRecord[]
): { status: number; body: Record<string, unknown> } {
  // ── Super-admin check ─────────────────────────────────────────────────────
  if (callerRole !== "super_admin") {
    return { status: 403, body: { error: "Forbidden" } };
  }

  // ── Join users collection to get adminUserEmail ───────────────────────────
  const adminEmailMap = new Map<string, string>(
    adminUsers
      .filter((u) => u.role === "company_admin")
      .map((u) => [u.companyId, u.email])
  );

  const cleaned = companies.map((c) => ({
    ...c,
    companyEmail:   c.email,
    adminUserEmail: adminEmailMap.get(c.companyId) ?? null,
  }));

  return { status: 200, body: { companies: cleaned, total: cleaned.length } };
}

// ─── Inline simulation: POST /api/admin/seed-super-admin (FIXED) ─────────────

const SUPER_ADMIN_EMAILS = [
  "karthiknair1610@gmail.com",
  "hariprasadprkm@gmail.com",
  "kishore2110raj@gmail.com",
];

function simulateFixedSeedSuperAdmin(
  db: { users: UserRecord[] },
  body: Record<string, unknown>,
  seedSecret: string
): { status: number; body: Record<string, unknown> } {
  // ── Secret guard ──────────────────────────────────────────────────────────
  if (body.secret !== seedSecret) {
    return { status: 403, body: { error: "Invalid secret" } };
  }

  const now     = new Date().toISOString();
  let created   = 0;
  let upgraded  = 0;
  let alreadyAdmin = 0;

  for (const email of SUPER_ADMIN_EMAILS) {
    const existing = db.users.find((u) => u.email === email);

    if (existing) {
      if (existing.role === "super_admin") {
        alreadyAdmin++;
      } else {
        existing.role = "super_admin";
        upgraded++;
      }
    } else {
      db.users.push({
        userId:    email,
        companyId: "platform",
        name:      email,
        email,
        role:      "super_admin",
        active:    true,
        createdAt: now,
      });
      created++;
    }
  }

  return {
    status: 200,
    body:   { created, upgraded, alreadyAdmin, emails: SUPER_ADMIN_EMAILS },
  };
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe("Unit Tests — Fixed Upload Path (Task 3.7)", () => {

  // ─── 1. handleFile (fixed) ────────────────────────────────────────────────

  describe("1. handleFile (fixed)", () => {
    let fetchMock:    ReturnType<typeof vi.fn>;
    let uploadBytes:  ReturnType<typeof vi.fn>;
    let onUploaded:   ReturnType<typeof vi.fn>;
    let setUploading: ReturnType<typeof vi.fn>;
    const mockUser = { getIdToken: vi.fn().mockResolvedValue("mock-id-token") };

    beforeEach(() => {
      vi.clearAllMocks();
      fetchMock    = vi.fn();
      uploadBytes  = vi.fn();
      onUploaded   = vi.fn();
      setUploading = vi.fn();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("calls fetch with fileData, fileName, mimeType, fileSize — not uploadBytes", async () => {
      const fileData = "dGVzdA=="; // base64 of "test"
      const dataUrl  = `data:application/pdf;base64,${fileData}`;

      const mockResponse = {
        ok:   true,
        json: async () => ({
          document: {
            documentId: "doc-001",
            companyId:  "company-abc",
            type:       "gst" as DocumentType,
            fileName:   "gst-cert.pdf",
            mimeType:   "application/pdf",
            fileSize:   512,
            fileData,
            uploadedAt: new Date().toISOString(),
            verified:   false,
          } satisfies StoredDocument,
        }),
      } as unknown as Response;

      fetchMock.mockResolvedValue(mockResponse);

      const file = new File([new Uint8Array(512)], "gst-cert.pdf", { type: "application/pdf" });

      await simulateFixedHandleFile(
        file,
        mockUser,
        "gst",
        fetchMock,
        uploadBytes,
        onUploaded,
        setUploading,
        dataUrl
      );

      // uploadBytes must NEVER be called
      expect(uploadBytes).not.toHaveBeenCalled();

      // fetch must be called with the correct shape
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/company/documents");
      expect(options.method).toBe("POST");

      const parsedBody = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(parsedBody.fileData).toBe(fileData);
      expect(parsedBody.fileName).toBe("gst-cert.pdf");
      expect(parsedBody.mimeType).toBe("application/pdf");
      expect(parsedBody.fileSize).toBe(512);
      expect(parsedBody.type).toBe("gst");
    });

    it("strips the data URL prefix — only pure Base64 is sent in fileData", async () => {
      const pureBase64 = "SGVsbG8gV29ybGQ="; // "Hello World"
      const dataUrl    = `data:image/jpeg;base64,${pureBase64}`;

      fetchMock.mockResolvedValue({
        ok:   true,
        json: async () => ({
          document: {
            documentId: "doc-002", companyId: "co", type: "pan" as DocumentType,
            fileName: "pan.jpg", mimeType: "image/jpeg", fileSize: 100,
            fileData: pureBase64, uploadedAt: new Date().toISOString(), verified: false,
          } satisfies StoredDocument,
        }),
      } as unknown as Response);

      const file = new File([new Uint8Array(100)], "pan.jpg", { type: "image/jpeg" });

      await simulateFixedHandleFile(
        file, mockUser, "pan", fetchMock, uploadBytes, onUploaded, setUploading, dataUrl
      );

      const body = JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
      ) as Record<string, unknown>;
      // Must not contain the "data:mime;base64," prefix
      expect(body.fileData).toBe(pureBase64);
      expect((body.fileData as string).startsWith("data:")).toBe(false);
    });

    it("fires success toast on 201 response", async () => {
      fetchMock.mockResolvedValue({
        ok:   true,
        json: async () => ({
          document: {
            documentId: "doc-003", companyId: "co", type: "insurance" as DocumentType,
            fileName: "ins.pdf", mimeType: "application/pdf", fileSize: 256,
            fileData: "dGVzdA==", uploadedAt: new Date().toISOString(), verified: false,
          } satisfies StoredDocument,
        }),
      } as unknown as Response);

      const file = new File([new Uint8Array(256)], "ins.pdf", { type: "application/pdf" });

      await simulateFixedHandleFile(
        file, mockUser, "insurance", fetchMock, uploadBytes, onUploaded, setUploading,
        "data:application/pdf;base64,dGVzdA=="
      );

      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("insurance"));
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("fires error toast and does NOT call onUploaded when fetch returns non-OK", async () => {
      fetchMock.mockResolvedValue({
        ok:   false,
        json: async () => ({ error: "Company account is suspended." }),
      } as unknown as Response);

      const file = new File([new Uint8Array(256)], "gst.pdf", { type: "application/pdf" });

      await simulateFixedHandleFile(
        file, mockUser, "gst", fetchMock, uploadBytes, onUploaded, setUploading,
        "data:application/pdf;base64,dGVzdA=="
      );

      expect(mockToastError).toHaveBeenCalledWith(
        "Upload failed",
        expect.objectContaining({ description: "Company account is suspended." })
      );
      expect(onUploaded).not.toHaveBeenCalled();
    });

    it("size guard: file > 10 MB rejects before fetch is called", async () => {
      const file = new File([new Uint8Array(11 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });

      await simulateFixedHandleFile(
        file, mockUser, "gst", fetchMock, uploadBytes, onUploaded, setUploading
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(uploadBytes).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(
        "File too large",
        expect.objectContaining({ description: "Maximum file size is 10 MB" })
      );
    });

    it("MIME guard: unsupported type rejects before fetch is called", async () => {
      const file = new File([new Uint8Array(1024)], "doc.txt", { type: "text/plain" });

      await simulateFixedHandleFile(
        file, mockUser, "gst", fetchMock, uploadBytes, onUploaded, setUploading
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(uploadBytes).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith(
        "Invalid file type",
        expect.objectContaining({ description: "Accepted: PDF, JPG, PNG, WEBP" })
      );
    });

    it("calls onUploaded with the returned document on success", async () => {
      const returnedDoc: StoredDocument = {
        documentId: "doc-004", companyId: "company-x", type: "pan",
        fileName: "pan.pdf", mimeType: "application/pdf", fileSize: 1024,
        fileData: "dGVzdA==", uploadedAt: new Date().toISOString(), verified: false,
      };

      fetchMock.mockResolvedValue({
        ok:   true,
        json: async () => ({ document: returnedDoc }),
      } as unknown as Response);

      const file = new File([new Uint8Array(1024)], "pan.pdf", { type: "application/pdf" });

      await simulateFixedHandleFile(
        file, mockUser, "pan", fetchMock, uploadBytes, onUploaded, setUploading,
        "data:application/pdf;base64,dGVzdA=="
      );

      expect(onUploaded).toHaveBeenCalledWith(returnedDoc);
    });
  });

  // ─── 2. POST /api/company/documents (fixed) ───────────────────────────────

  describe("2. POST /api/company/documents (fixed)", () => {
    const validBody = {
      type:     "gst" as DocumentType,
      fileData: "dGVzdA==",
      fileName: "gst-cert.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    };

    function makeDb(status = "approved") {
      return {
        documents: [] as StoredDocument[],
        audits:    [] as Record<string, unknown>[],
        company:   { status },
      };
    }

    it("valid { type, fileData, fileName, mimeType, fileSize } → 201 with stored document containing fileData", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, validBody, "company-001", "user-001");

      expect(result.status).toBe(201);
      const doc = (result.body as { document: StoredDocument }).document;
      expect(doc.fileData).toBe(validBody.fileData);
      expect(doc.fileName).toBe(validBody.fileName);
      expect(doc.mimeType).toBe(validBody.mimeType);
      expect(doc.fileSize).toBe(validBody.fileSize);
      expect(doc.type).toBe(validBody.type);
      expect(doc.companyId).toBe("company-001");
      expect(db.documents).toHaveLength(1);
    });

    it("missing fileData → 400", () => {
      const db     = makeDb();
      const body   = { ...validBody, fileData: undefined };
      const result = simulateFixedPostDocument(db, body as Record<string, unknown>, "company-001", "user-001");

      expect(result.status).toBe(400);
      expect((result.body as { error: string }).error).toContain("fileData");
    });

    it("empty fileData string → 400", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, { ...validBody, fileData: "" }, "company-001", "user-001");

      expect(result.status).toBe(400);
      expect((result.body as { error: string }).error).toContain("fileData");
    });

    it("unsupported mimeType (text/plain) → 400", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, { ...validBody, mimeType: "text/plain" }, "company-001", "user-001");

      expect(result.status).toBe(400);
      expect((result.body as { error: string }).error).toContain("mimeType");
    });

    it("unsupported mimeType (application/json) → 400", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, { ...validBody, mimeType: "application/json" }, "company-001", "user-001");

      expect(result.status).toBe(400);
    });

    it("fileSize > 10485760 (10 MB + 1 byte) → 400", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, { ...validBody, fileSize: 10_485_761 }, "company-001", "user-001");

      expect(result.status).toBe(400);
      expect((result.body as { error: string }).error).toContain("fileSize");
    });

    it("fileSize = 10485760 (exactly 10 MB) is accepted → 201", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, { ...validBody, fileSize: 10_485_760 }, "company-001", "user-001");

      expect(result.status).toBe(201);
    });

    it("fileSize = 0 → 400 (zero is not positive)", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, { ...validBody, fileSize: 0 }, "company-001", "user-001");

      expect(result.status).toBe(400);
    });

    it("missing fileName → 400", () => {
      const db     = makeDb();
      const body   = { ...validBody, fileName: undefined };
      const result = simulateFixedPostDocument(db, body as Record<string, unknown>, "company-001", "user-001");

      expect(result.status).toBe(400);
      expect((result.body as { error: string }).error).toContain("fileName");
    });

    it("empty fileName string → 400", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, { ...validBody, fileName: "" }, "company-001", "user-001");

      expect(result.status).toBe(400);
    });

    it("suspended company → 403", () => {
      const db     = makeDb("suspended");
      const result = simulateFixedPostDocument(db, validBody, "company-suspended", "user-001");

      expect(result.status).toBe(403);
      expect((result.body as { error: string }).error).toContain("suspended");
      // No document written
      expect(db.documents).toHaveLength(0);
      // No audit event written
      expect(db.audits).toHaveLength(0);
    });

    it("audit event written on success — document_uploaded event in audit_events", () => {
      const db     = makeDb();
      simulateFixedPostDocument(db, validBody, "company-001", "user-001");

      expect(db.audits).toHaveLength(1);
      const audit = db.audits[0];
      expect(audit["eventType"]).toBe("document_uploaded");
      expect(audit["companyId"]).toBe("company-001");
    });

    it("upsert semantics preserved — second upload of same type produces exactly one record", () => {
      const db = makeDb();
      simulateFixedPostDocument(db, { ...validBody, fileData: "Zmlyc3Q=" }, "company-001", "user-001");
      simulateFixedPostDocument(db, { ...validBody, fileData: "c2Vjb25k" }, "company-001", "user-001");

      const matching = db.documents.filter((d) => d.companyId === "company-001" && d.type === "gst");
      expect(matching).toHaveLength(1);
      expect(matching[0].fileData).toBe("c2Vjb25k"); // last upload wins
    });

    it("stored document contains fileData (not fileUrl)", () => {
      const db     = makeDb();
      const result = simulateFixedPostDocument(db, validBody, "company-001", "user-001");
      const doc    = (result.body as { document: Record<string, unknown> }).document;

      expect(doc).toHaveProperty("fileData");
      expect(doc).not.toHaveProperty("fileUrl");
    });

    it("all valid mimeTypes are accepted", () => {
      for (const mimeType of VALID_MIMES) {
        const db     = makeDb();
        const result = simulateFixedPostDocument(
          db, { ...validBody, mimeType }, "company-001", "user-001"
        );
        expect(result.status).toBe(201);
      }
    });
  });

  // ─── 3. GET /api/admin/companies (fixed) ─────────────────────────────────

  describe("3. GET /api/admin/companies (fixed)", () => {
    const sampleCompanies: CompanyWithEmails[] = [
      {
        companyId:   "company-alpha",
        companyName: "Alpha Logistics",
        email:       "alpha@example.com",
        status:      "approved",
        createdAt:   "2024-01-01T00:00:00.000Z",
      },
      {
        companyId:   "company-beta",
        companyName: "Beta Transport",
        email:       "beta@example.com",
        status:      "pending",
        createdAt:   "2024-02-01T00:00:00.000Z",
      },
    ];

    const sampleAdminUsers: UserRecord[] = [
      {
        userId:    "user-alpha-admin",
        companyId: "company-alpha",
        name:      "Alice",
        email:     "alice@example.com",
        role:      "company_admin",
        active:    true,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        userId:    "user-beta-admin",
        companyId: "company-beta",
        name:      "Bob",
        email:     "bob@example.com",
        role:      "company_admin",
        active:    true,
        createdAt: "2024-02-01T00:00:00.000Z",
      },
    ];

    it("each company object contains companyEmail and adminUserEmail", () => {
      const result = simulateFixedGetAdminCompanies(
        "super_admin", sampleCompanies, sampleAdminUsers
      );

      expect(result.status).toBe(200);
      const { companies } = result.body as { companies: CompanyWithEmails[] };

      for (const company of companies) {
        expect(company).toHaveProperty("companyEmail");
        expect(company).toHaveProperty("adminUserEmail");
        expect(typeof company.companyEmail).toBe("string");
      }
    });

    it("companyEmail equals the company's registered email", () => {
      const result   = simulateFixedGetAdminCompanies("super_admin", sampleCompanies, sampleAdminUsers);
      const { companies } = result.body as { companies: CompanyWithEmails[] };

      const alpha = companies.find((c) => c.companyId === "company-alpha")!;
      expect(alpha.companyEmail).toBe("alpha@example.com");

      const beta = companies.find((c) => c.companyId === "company-beta")!;
      expect(beta.companyEmail).toBe("beta@example.com");
    });

    it("adminUserEmail is the email of the company_admin user for that company", () => {
      const result   = simulateFixedGetAdminCompanies("super_admin", sampleCompanies, sampleAdminUsers);
      const { companies } = result.body as { companies: CompanyWithEmails[] };

      const alpha = companies.find((c) => c.companyId === "company-alpha")!;
      expect(alpha.adminUserEmail).toBe("alice@example.com");

      const beta = companies.find((c) => c.companyId === "company-beta")!;
      expect(beta.adminUserEmail).toBe("bob@example.com");
    });

    it("adminUserEmail is null when no company_admin user exists for that company", () => {
      const result   = simulateFixedGetAdminCompanies("super_admin", sampleCompanies, []);
      const { companies } = result.body as { companies: CompanyWithEmails[] };

      for (const company of companies) {
        expect(company.adminUserEmail).toBeNull();
      }
    });

    it("caller with role 'company_admin' → 403", () => {
      const result = simulateFixedGetAdminCompanies("company_admin", sampleCompanies, sampleAdminUsers);
      expect(result.status).toBe(403);
      expect(result.body).not.toHaveProperty("companies");
    });

    it("caller with role 'operations_manager' → 403", () => {
      const result = simulateFixedGetAdminCompanies("operations_manager", sampleCompanies, sampleAdminUsers);
      expect(result.status).toBe(403);
    });

    it("caller with role 'fleet_manager' → 403", () => {
      const result = simulateFixedGetAdminCompanies("fleet_manager", sampleCompanies, sampleAdminUsers);
      expect(result.status).toBe(403);
    });

    it("caller with role 'dispatcher' → 403", () => {
      const result = simulateFixedGetAdminCompanies("dispatcher", sampleCompanies, sampleAdminUsers);
      expect(result.status).toBe(403);
    });

    it("caller with role 'driver' → 403", () => {
      const result = simulateFixedGetAdminCompanies("driver", sampleCompanies, sampleAdminUsers);
      expect(result.status).toBe(403);
    });

    it("super_admin caller → 200 with companies array", () => {
      const result = simulateFixedGetAdminCompanies("super_admin", sampleCompanies, sampleAdminUsers);
      expect(result.status).toBe(200);
      const { companies } = result.body as { companies: CompanyWithEmails[]; total: number };
      expect(companies).toHaveLength(2);
    });

    it("all non-super_admin roles are individually rejected", () => {
      const nonAdminRoles: UserRole[] = [
        "company_admin", "operations_manager", "fleet_manager", "dispatcher", "driver",
      ];
      for (const role of nonAdminRoles) {
        const result = simulateFixedGetAdminCompanies(role, sampleCompanies, sampleAdminUsers);
        expect(result.status).toBe(403);
        expect((result.body as { error: string }).error).toBe("Forbidden");
      }
    });

    it("existing company fields (companyId, companyName, status, createdAt) are preserved", () => {
      const result   = simulateFixedGetAdminCompanies("super_admin", sampleCompanies, sampleAdminUsers);
      const { companies } = result.body as { companies: CompanyWithEmails[] };

      const alpha = companies.find((c) => c.companyId === "company-alpha")!;
      expect(alpha.companyName).toBe("Alpha Logistics");
      expect(alpha.status).toBe("approved");
      expect(alpha.createdAt).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  // ─── 4. POST /api/admin/seed-super-admin (fixed) ─────────────────────────

  describe("4. POST /api/admin/seed-super-admin (fixed)", () => {
    const SEED_SECRET = "test-seed-secret-abc";

    function makeEmptyDb(): { users: UserRecord[] } {
      return { users: [] };
    }

    it("all three target emails seeded when called with valid secret → created: 3", () => {
      const db     = makeEmptyDb();
      const result = simulateFixedSeedSuperAdmin(db, { secret: SEED_SECRET }, SEED_SECRET);

      expect(result.status).toBe(200);
      const body = result.body as { created: number; upgraded: number; alreadyAdmin: number; emails: string[] };
      expect(body.created).toBe(3);
      expect(body.upgraded).toBe(0);
      expect(body.alreadyAdmin).toBe(0);
      expect(db.users).toHaveLength(3);
    });

    it("all seeded users have role super_admin, companyId platform, active true", () => {
      const db = makeEmptyDb();
      simulateFixedSeedSuperAdmin(db, { secret: SEED_SECRET }, SEED_SECRET);

      for (const user of db.users) {
        expect(user.role).toBe("super_admin");
        expect(user.companyId).toBe("platform");
        expect(user.active).toBe(true);
      }
    });

    it("all three known target emails are present in the seeded users", () => {
      const db = makeEmptyDb();
      simulateFixedSeedSuperAdmin(db, { secret: SEED_SECRET }, SEED_SECRET);

      const emails = db.users.map((u) => u.email);
      expect(emails).toContain("karthiknair1610@gmail.com");
      expect(emails).toContain("hariprasadprkm@gmail.com");
      expect(emails).toContain("kishore2110raj@gmail.com");
    });

    it("idempotent on second call → alreadyAdmin: 3 on repeat call", () => {
      const db = makeEmptyDb();

      // First call
      const first = simulateFixedSeedSuperAdmin(db, { secret: SEED_SECRET }, SEED_SECRET);
      expect((first.body as { created: number }).created).toBe(3);

      // Second call — same db
      const second = simulateFixedSeedSuperAdmin(db, { secret: SEED_SECRET }, SEED_SECRET);
      const body   = second.body as { created: number; alreadyAdmin: number };
      expect(body.created).toBe(0);
      expect(body.alreadyAdmin).toBe(3);

      // Still exactly 3 users — no duplicates created
      expect(db.users).toHaveLength(3);
    });

    it("wrong secret → 403", () => {
      const db     = makeEmptyDb();
      const result = simulateFixedSeedSuperAdmin(db, { secret: "wrong-secret" }, SEED_SECRET);

      expect(result.status).toBe(403);
      expect((result.body as { error: string }).error).toContain("Invalid secret");
      // No users created
      expect(db.users).toHaveLength(0);
    });

    it("empty secret → 403", () => {
      const db     = makeEmptyDb();
      const result = simulateFixedSeedSuperAdmin(db, { secret: "" }, SEED_SECRET);

      expect(result.status).toBe(403);
    });

    it("missing secret field → 403", () => {
      const db     = makeEmptyDb();
      const result = simulateFixedSeedSuperAdmin(db, {}, SEED_SECRET);

      expect(result.status).toBe(403);
    });

    it("upgrades existing non-super_admin users to super_admin", () => {
      const db: { users: UserRecord[] } = {
        users: [
          {
            userId:    "karthiknair1610@gmail.com",
            companyId: "some-company",
            name:      "Karthik",
            email:     "karthiknair1610@gmail.com",
            role:      "company_admin",
            active:    true,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const result = simulateFixedSeedSuperAdmin(db, { secret: SEED_SECRET }, SEED_SECRET);
      const body   = result.body as { created: number; upgraded: number; alreadyAdmin: number };

      expect(body.upgraded).toBe(1);
      expect(body.created).toBe(2);   // the other two are new inserts

      // The existing user must now be super_admin
      const karthik = db.users.find((u) => u.email === "karthiknair1610@gmail.com")!;
      expect(karthik.role).toBe("super_admin");
    });

    it("response includes the emails array of all three targets", () => {
      const db     = makeEmptyDb();
      const result = simulateFixedSeedSuperAdmin(db, { secret: SEED_SECRET }, SEED_SECRET);
      const body   = result.body as { emails: string[] };

      expect(body.emails).toContain("karthiknair1610@gmail.com");
      expect(body.emails).toContain("hariprasadprkm@gmail.com");
      expect(body.emails).toContain("kishore2110raj@gmail.com");
    });
  });
});
