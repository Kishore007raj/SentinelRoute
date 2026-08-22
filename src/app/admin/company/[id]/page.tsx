"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2, MapPin, Truck, FileText,
  CheckCircle2, XCircle, MessageSquare, Loader2,
  ChevronLeft, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser } from "@/lib/auth-context";
import { fetchApi } from "@/lib/api-client";
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
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="label-meta shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground text-right font-mono">{value ?? "—"}</span>
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
      const res   = await fetchApi(`/api/admin/companies/${companyId}`, {
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
      const res = await fetchApi(`/api/admin/companies/${companyId}`, {
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!company) return null;

  const statusColor =
    company.status === "approved"  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    company.status === "rejected"  ? "text-rose-400 bg-rose-500/10 border-rose-500/20"         :
    company.status === "suspended" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"       : "text-amber-400 bg-amber-500/10 border-amber-500/20";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push("/admin/companies")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Tenant Applications
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{company.companyName}</h1>
            <p className="text-xs text-muted-foreground font-mono">{company.companyType} · {company.companyId}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded border ${statusColor}`}>
          {company.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Information */}
        <div className="panel p-6">
          <p className="label-meta mb-4">Company Profile</p>
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
        </div>

        {/* Operations */}
        <div className="panel p-6">
          <p className="label-meta mb-4">Operations & Footprint</p>
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-amber-500" />
              <div>
                <p className="font-semibold text-foreground font-mono">{company.fleetSize} vehicles</p>
                <p className="text-muted-foreground text-[11px]">Registered Fleet Size</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-sky-400 mt-0.5" />
              <div>
                <p className="label-meta mb-1">Operating States</p>
                <div className="flex flex-wrap gap-1.5">
                  {company.operatingStates && company.operatingStates.length > 0 ? (
                    company.operatingStates.map((s) => (
                      <span key={s} className="text-[10px] font-mono bg-muted/30 border border-border px-2 py-0.5 rounded text-foreground">{s}</span>
                    ))
                  ) : (
                    <span className="text-muted-foreground italic">None specified</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="label-meta mb-1">Cargo Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {company.cargoCategories && company.cargoCategories.length > 0 ? (
                    company.cargoCategories.map((c) => (
                      <span key={c} className="text-[10px] font-mono bg-muted/30 border border-border px-2 py-0.5 rounded text-foreground">{c}</span>
                    ))
                  ) : (
                    <span className="text-muted-foreground italic">None specified</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="panel p-6 lg:col-span-2">
          <p className="label-meta mb-4">Verification Documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {["gst","pan","insurance","transport_license","fleet_insurance"].map((type) => {
              const doc = documents.find((d) => d.type === type);
              return (
                <div key={type} className="border border-border rounded-lg p-3 bg-muted/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{DOC_LABELS[type]}</p>
                    {doc ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" />
                    )}
                  </div>
                  {doc ? (
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/70 truncate" title={doc.fileName}>
                        {doc.fileName}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/50">Not uploaded</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="panel p-6 lg:col-span-2">
          <p className="label-meta mb-4">Review Decision & Auditing</p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="label-meta">Review Note (Optional)</label>
              <textarea
                className="w-full min-h-[64px] px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none font-mono"
                placeholder="Add audit note or reason for decision..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              {company.status !== "approved" && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!!acting}
                  onClick={() => handleAction("approve")}
                >
                  {acting === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve Company
                </Button>
              )}
              {company.status !== "rejected" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                  disabled={!!acting}
                  onClick={() => handleAction("reject")}
                >
                  {acting === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Reject
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-border"
                disabled={!!acting}
                onClick={() => handleAction("clarification")}
              >
                {acting === "clarification" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                Request Clarification
              </Button>
              {company.status === "approved" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  disabled={!!acting}
                  onClick={() => handleAction("suspend")}
                >
                  {acting === "suspend" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  Suspend
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
