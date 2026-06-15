"use client";
/**
 * /admin/companies
 *
 * Super admin review panel — list all companies by status.
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Building2, MapPin, Truck, Calendar, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useUser } from "@/lib/auth-context";
import type { Company, CompanyStatus } from "@/lib/types";

// Augment Company with the extra fields returned by /api/admin/companies
type AdminCompany = Company & {
  companyEmail?: string;
  adminUserEmail?: string;
};

type TabId = CompanyStatus | "all";

const TABS: { id: TabId; label: string }[] = [
  { id: "pending",   label: "Pending" },
  { id: "approved",  label: "Approved" },
  { id: "rejected",  label: "Rejected" },
  { id: "suspended", label: "Suspended" },
];

const STATUS_STYLES: Record<CompanyStatus, string> = {
  pending:   "bg-amber-400/10 text-amber-400 border-amber-400/20",
  approved:  "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  rejected:  "bg-red-400/10 text-red-400 border-red-400/20",
  suspended: "bg-orange-400/10 text-orange-400 border-orange-400/20",
};

function CompanyCard({ company }: { company: AdminCompany }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-border/80 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{company.companyName}</p>
            <p className="text-xs text-muted-foreground">{company.companyType}</p>
          </div>
        </div>
        <span className={[
          "text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0",
          STATUS_STYLES[company.status],
        ].join(" ")}>
          {company.status}
        </span>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Truck className="w-3 h-3 shrink-0" />
          <span>{company.fleetSize} vehicles</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 shrink-0" />
          <span>{company.operatingStates.length} state{company.operatingStates.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{new Date(company.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
        </div>
      </div>

      {/* GST/PAN quick view */}
      <div className="flex gap-4 text-xs">
        <div>
          <span className="text-muted-foreground/60 uppercase tracking-widest text-[10px]">GST </span>
          <span className="font-mono text-muted-foreground">{company.gstNumber}</span>
        </div>
        <div>
          <span className="text-muted-foreground/60 uppercase tracking-widest text-[10px]">PAN </span>
          <span className="font-mono text-muted-foreground">{company.panNumber}</span>
        </div>
      </div>

      {/* Email quick view */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div>
          <span className="text-muted-foreground/60">Company Email: </span>
          <span>{company.companyEmail ?? "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground/60">Admin Email: </span>
          <span>{company.adminUserEmail ?? "—"}</span>
        </div>
      </div>

      {/* Action */}
      <Link href={`/admin/company/${company.companyId}`}>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 mt-1">
          <Eye className="w-3 h-3" />
          Review Application
        </Button>
      </Link>
    </motion.div>
  );
}

export default function AdminCompaniesPage() {
  const { user } = useUser();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("pending");

  const fetchCompanies = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res   = await fetch("/api/admin/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCompanies(data.companies ?? []);
    } catch (err) {
      console.error("[admin/companies]", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const filtered = activeTab === "all"
    ? companies
    : companies.filter((c) => c.status === activeTab);

  const countByStatus = (s: CompanyStatus) => companies.filter((c) => c.status === s).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Admin Panel</p>
          <h1 className="text-2xl font-bold text-foreground">Company Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage company verification requests
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 h-9" onClick={fetchCompanies}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {(["pending", "approved", "rejected", "suspended"] as CompanyStatus[]).map((s) => (
          <div key={s} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{s}</p>
            <p className="text-2xl font-bold text-foreground">{countByStatus(s)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <TabsList className="h-10 bg-muted/20 gap-1 p-1 mb-6">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="h-8 px-4 text-sm gap-2">
              {t.label}
              {t.id !== "all" && (
                <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded-full">
                  {countByStatus(t.id as CompanyStatus)}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-sm text-muted-foreground">No {t.id} applications</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((c) => (
                  <CompanyCard key={c.companyId} company={c} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
