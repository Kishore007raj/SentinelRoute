"use client";
/**
 * /admin/company/[id]
 * Full company review page for super admin.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2, MapPin, Truck, FileText, ExternalLink,
  CheckCircle2, XCircle, MessageSquare, Loader2,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@/lib/auth-context";
import type { Company, CompanyDocument } from "@/lib/types";

const DOC_LABELS: Record<string, string> = {
  gst:               "GST Certificate",
  pan:               "PAN Document",
  insurance:         "Insurance Proof",
  transport_license: "Transport License",
  fleet_insurance:   "Fleet Insurance",
};

function InfoRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-widest shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value ?? "—"}</span>
    </div>
  );
}

export default function AdminCompanyReviewPage() {
  const router = useRouter();
  const { id: companyId } = useParams<{ id: string }>();
  const { user } = useUser();

  const [company,   setCompany]   = useState<Company | null>(null);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState<string | null>(null);
  const [note,      setNote]      = useState("");

  const fetchData = useCallback(async () => {
    if (!user || !companyId) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res   = await fetch(`/api/admin/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error("Company not found"); router.push("/admin/companies"); return; }
      const data = await res.json();
      setCompany(data.company);
      setDocuments(data.documents ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [user, companyId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (action: "approve" | "reject" | "suspend" | "clarification") => {
    if (!user) return;
    setActing(action);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Action failed"); }
      const data = await res.json();
      setCompany(data.company);
      toast.success(
        action === "approve"       ? "Company approved"        :
        action === "reject"        ? "Company rejected"        :
        action === "suspend"       ? "Company suspended"       :
        "Clarification requested"
      );
      setNote("");
    } catch (err) {
      toast.error("Action failed", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) return null;

  const statusColor =
    company.status === "approved"  ? "text-emerald-400" :
    company.status === "rejected"  ? "text-red-400"     :
    company.status === "suspended" ? "text-orange-400"  : "text-amber-400";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Back */}
      <button
        onClick={() => router.push("/admin/companies")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Applications
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{company.companyName}</h1>
            <p className="text-sm text-muted-foreground">{company.companyType}</p>
          </div>
        </div>
        <span className={["text-sm font-semibold capitalize", statusColor].join(" ")}>
          {company.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Company Information ── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Company Information</p>
          <div className="space-y-0">
            <InfoRow label="Company Name" value={company.companyName} />
            <InfoRow label="Type"         value={company.companyType} />
            <InfoRow label="GST"          value={company.gstNumber} />
            <InfoRow label="PAN"          value={company.panNumber} />
            <InfoRow label="Website"      value={company.website || "—"} />
            <InfoRow label="Email"        value={company.email} />
            <InfoRow label="Phone"        value={company.phone} />
            <InfoRow label="Address"      value={company.address} />
          </div>
        </motion.div>

        {/* ── Operations ── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Operations</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{company.fleetSize} vehicles</p>
                <p className="text-xs text-muted-foreground">Fleet size</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Operating States</p>
                <div className="flex flex-wrap gap-1.5">
                  {company.operatingStates.map((s) => (
                    <span key={s} className="text-[11px] bg-muted/20 border border-border px-2 py-0.5 rounded text-foreground">{s}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cargo Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {company.cargoCategories.map((c) => (
                    <span key={c} className="text-[11px] bg-muted/20 border border-border px-2 py-0.5 rounded text-foreground">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Documents ── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Verification Documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {["gst","pan","insurance","transport_license","fleet_insurance"].map((type) => {
              const doc = documents.find((d) => d.type === type);
              return (
                <div key={type} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{DOC_LABELS[type]}</p>
                    {doc ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>
                  {doc ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> View Document
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/50">Not uploaded</p>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Actions ── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Review Actions</p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <textarea
                className="w-full min-h-[72px] px-3 py-2 rounded-lg bg-muted/20 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder="Add a note or reason for this action..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {company.status !== "approved" && (
                <Button
                  className="gap-2 h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!!acting}
                  onClick={() => handleAction("approve")}
                >
                  {acting === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Approve Company
                </Button>
              )}
              {company.status !== "rejected" && (
                <Button
                  variant="outline"
                  className="gap-2 h-10 px-5 border-red-400/30 text-red-400 hover:bg-red-400/10"
                  disabled={!!acting}
                  onClick={() => handleAction("reject")}
                >
                  {acting === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2 h-10 px-5"
                disabled={!!acting}
                onClick={() => handleAction("clarification")}
              >
                {acting === "clarification" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Request Clarification
              </Button>
              {company.status === "approved" && (
                <Button
                  variant="outline"
                  className="gap-2 h-10 px-5 border-orange-400/30 text-orange-400 hover:bg-orange-400/10"
                  disabled={!!acting}
                  onClick={() => handleAction("suspend")}
                >
                  {acting === "suspend" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Suspend
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
