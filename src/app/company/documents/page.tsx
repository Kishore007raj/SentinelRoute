"use client";
/**
 * /company/documents
 *
 * Upload required verification documents.
 * Uses Firebase Storage for file hosting, then records URLs in MongoDB.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Upload, CheckCircle2, AlertCircle, FileText,
  Loader2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import type { DocumentType, CompanyDocument } from "@/lib/types";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

// ─── Document metadata ────────────────────────────────────────────────────────

const REQUIRED_DOCS: { type: DocumentType; label: string; description: string }[] = [
  { type: "gst",               label: "GST Certificate",     description: "GST registration certificate from the government portal" },
  { type: "pan",               label: "PAN Document",        description: "Company PAN card or PAN allotment letter" },
  { type: "insurance",         label: "Insurance Proof",     description: "Company liability or cargo insurance policy" },
  { type: "transport_license", label: "Transport License",   description: "Transport/logistics operation license" },
  { type: "fleet_insurance",   label: "Fleet Insurance",     description: "Insurance document covering the company fleet" },
];

// ─── Single document upload row ───────────────────────────────────────────────

function DocumentRow({
  docMeta,
  existing,
  onUploaded,
  companyId,
}: {
  docMeta: typeof REQUIRED_DOCS[number];
  existing?: CompanyDocument;
  onUploaded: (doc: CompanyDocument) => void;
  companyId: string;
}) {
  const { user } = useUser();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum file size is 10 MB" });
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Invalid file type", { description: "Accepted: PDF, JPG, PNG, WEBP" });
      return;
    }

    setUploading(true);
    try {
      // Upload to Firebase Storage
      const path = `company-documents/${companyId}/${docMeta.type}-${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);

      // Save to MongoDB via API
      const token = await user.getIdToken();
      const res = await fetch("/api/company/documents", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ type: docMeta.type, fileUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      const data = await res.json();
      onUploaded(data.document as CompanyDocument);
      toast.success(`${docMeta.label} uploaded`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error("Upload failed", { description: msg });
    } finally {
      setUploading(false);
    }
  };

  const isUploaded = !!existing;

  return (
    <div className="flex items-center gap-5 py-5 border-b border-border/30 last:border-0">
      {/* Status icon */}
      <div className="shrink-0">
        {isUploaded ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-400/60" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <p className="text-sm font-semibold text-foreground">{docMeta.label}</p>
          {isUploaded && (
            <span className="text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-2 py-0.5 rounded-full font-medium">
              Uploaded
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{docMeta.description}</p>
        {isUploaded && existing?.uploadedAt && (
          <p className="text-[11px] text-muted-foreground/50 font-mono">
            {new Date(existing.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          variant={isUploaded ? "outline" : "default"}
          size="sm"
          className="h-8 px-4 text-xs gap-1.5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
          ) : isUploaded ? (
            <><RefreshCw className="w-3 h-3" /> Replace</>
          ) : (
            <><Upload className="w-3 h-3" /> Upload</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompanyDocumentsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { company, status, refresh } = useCompany();

  const [documents,  setDocuments]  = useState<CompanyDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing documents
  useEffect(() => {
    if (!user || !company) return;
    const load = async () => {
      try {
        const token = await user.getIdToken();
        const res   = await fetch("/api/company/documents", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setDocuments(data.documents ?? []);
      } catch {
        // non-fatal
      } finally {
        setLoadingDocs(false);
      }
    };
    load();
  }, [user, company]);

  // Redirect if no company registered yet
  useEffect(() => {
    if (status === "none") router.replace("/company/register");
    if (status === "approved") router.replace("/dashboard");
    if (status === "pending") {
      // Check if already submitted (documents page is for pre-submission)
      // Allow access to upload docs even in pending state
    }
  }, [status, router]);

  const handleDocUploaded = (doc: CompanyDocument) => {
    setDocuments((prev) => {
      const idx = prev.findIndex((d) => d.type === doc.type);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = doc;
        return next;
      }
      return [...prev, doc];
    });
  };

  const uploadedTypes   = documents.map((d) => d.type);
  const allUploaded     = REQUIRED_DOCS.every((d) => uploadedTypes.includes(d.type));
  const uploadedCount   = REQUIRED_DOCS.filter((d) => uploadedTypes.includes(d.type)).length;

  const handleSubmit = async () => {
    if (!user || !allUploaded) return;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res   = await fetch("/api/company/submit", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error("Submission failed", { description: data.error ?? "Please try again" });
        return;
      }

      await refresh();
      toast.success("Application submitted", {
        description: "Our team will review your documents. You will be notified on approval.",
      });
      router.push("/company/pending");
    } catch (err) {
      console.error("[submit]", err);
      toast.error("Submission failed", { description: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDocs || !company) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Verification</p>
        <h1 className="text-2xl font-bold text-foreground">Upload Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload the required legal documents to verify your company. All documents are stored securely.
        </p>
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {uploadedCount} of {REQUIRED_DOCS.length} documents uploaded
          </p>
          <p className="text-xs text-muted-foreground">
            All {REQUIRED_DOCS.length} documents are required for verification
          </p>
        </div>
        <div className="relative w-14 h-14 shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" className="stroke-border fill-none" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="22"
              className="stroke-primary fill-none"
              strokeWidth="4"
              strokeDasharray={`${(uploadedCount / REQUIRED_DOCS.length) * 138.2} 138.2`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
            {Math.round((uploadedCount / REQUIRED_DOCS.length) * 100)}%
          </span>
        </div>
      </div>

      {/* Document list */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl px-6 py-2 mb-6"
      >
        {REQUIRED_DOCS.map((doc) => (
          <DocumentRow
            key={doc.type}
            docMeta={doc}
            existing={documents.find((d) => d.type === doc.type)}
            onUploaded={handleDocUploaded}
            companyId={company.companyId}
          />
        ))}
      </motion.div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          className="h-10 px-5"
          onClick={() => router.push("/company/register")}
        >
          Back to Details
        </Button>

        <Button
          className="h-10 px-6 gap-2"
          disabled={!allUploaded || submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
          ) : (
            "Submit For Verification"
          )}
        </Button>
      </div>

      {!allUploaded && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          Upload all {REQUIRED_DOCS.length} documents to submit your application
        </p>
      )}
    </div>
  );
}
