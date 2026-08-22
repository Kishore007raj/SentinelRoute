"use client";

import { useState, useEffect, use, useCallback } from "react";
import { ArrowLeft, Building2, ShieldAlert, CheckCircle2, Clock, Ban, Users, Package, Truck, Key, Activity, FileText, Check, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CompanyDoc {
  documentId: string;
  type: string;
  uploadedAt: string;
  fileUrl?: string;
}

interface CompanyStats {
  users: number;
  drivers: number;
  shipments: number;
  vehicles: number;
}

interface CompanyData {
  company: {
    companyId: string;
    companyName: string;
    status: string;
    contactName?: string;
    email?: string;
    phone?: string;
    taxId?: string;
    createdAt?: string;
    address?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string };
  };
  documents: CompanyDoc[];
  stats: CompanyStats;
}

export default function CompanyInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useUser();

  const [data, setData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; action: string | null }>({ isOpen: false, action: null });
  const [actionNote, setActionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCompanyData = useCallback(async () => {
    if (!user) return; // Wait for Firebase auth to resolve before fetching
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/companies/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error("Failed to load company details", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchCompanyData();
    }
  }, [authLoading, user, fetchCompanyData]);

  const handleAction = async () => {
    if (!actionModal.action || !user) return;
    
    try {
      setSubmitting(true);
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: actionModal.action, note: actionNote }),
      });
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Action failed");
      }
      
      toast.success(`Company ${actionModal.action}d successfully`);
      setActionModal({ isOpen: false, action: null });
      setActionNote("");
      await fetchCompanyData();
    } catch (err) {
      toast.error("An error occurred", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-border border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.company) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-rose-400">Company Not Found</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">No tenant organization matches identifier: <span className="font-mono">{id}</span></p>
        <Link href="/admin/companies" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Return to Tenant List
        </Link>
      </div>
    );
  }

  const { company, documents, stats } = data;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs"><Clock className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      case "suspended":
        return <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-xs"><Ban className="w-3 h-3 mr-1" /> Suspended</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-muted text-muted-foreground border-border text-xs"><ShieldAlert className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/companies" className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "border-border")}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{company.companyName}</h1>
              {getStatusBadge(company.status)}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Tenant ID: {company.companyId}</p>
          </div>
        </div>
        
        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {company.status === "pending" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                onClick={() => setActionModal({ isOpen: true, action: "reject" })}
              >
                Reject Application
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                onClick={() => setActionModal({ isOpen: true, action: "approve" })}
              >
                <Check className="w-3.5 h-3.5" />
                Approve Tenant
              </Button>
            </>
          )}
          {company.status === "approved" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1.5"
              onClick={() => setActionModal({ isOpen: true, action: "suspend" })}
            >
              <Ban className="w-3.5 h-3.5" />
              Suspend Tenant
            </Button>
          )}
          {company.status === "suspended" && (
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={() => setActionModal({ isOpen: true, action: "restore" })}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Restore Access
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Profile & Stats */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Panel */}
          <div className="panel p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              Organizational Profile
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1">
                <span className="label-meta">Primary Contact</span>
                <p className="font-medium text-foreground text-sm">{company.contactName || "—"}</p>
                <p className="text-muted-foreground font-mono">{company.email || "—"}</p>
                <p className="text-muted-foreground font-mono">{company.phone || "—"}</p>
              </div>
              <div className="space-y-1">
                <span className="label-meta">Registered Address</span>
                <p className="font-medium text-foreground">{company.address?.street || "—"}</p>
                <p className="text-muted-foreground">{[company.address?.city, company.address?.state, company.address?.zipCode].filter(Boolean).join(", ") || "—"}</p>
                <p className="text-muted-foreground">{company.address?.country || "—"}</p>
              </div>
              <div className="space-y-1 pt-2 border-t border-border/50">
                <span className="label-meta">Tax ID / Registration</span>
                <p className="font-medium font-mono text-foreground">{company.taxId || "Not provided"}</p>
              </div>
              <div className="space-y-1 pt-2 border-t border-border/50">
                <span className="label-meta">Registration Timestamp</span>
                <p className="font-medium font-mono text-foreground">
                  {company.createdAt ? format(new Date(company.createdAt), "PPP p") : "Unknown"}
                </p>
              </div>
            </div>
          </div>

          {/* Platform Usage Stats */}
          <div className="panel p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              Tenant Resource Footprint
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-center">
                <Users className="w-4 h-4 mx-auto mb-1.5 text-sky-400" />
                <div className="text-xl font-bold font-mono text-foreground">{stats.users}</div>
                <div className="label-meta mt-0.5">Operators</div>
              </div>
              <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-center">
                <Truck className="w-4 h-4 mx-auto mb-1.5 text-amber-500" />
                <div className="text-xl font-bold font-mono text-foreground">{stats.drivers}</div>
                <div className="label-meta mt-0.5">Drivers</div>
              </div>
              <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-center">
                <Package className="w-4 h-4 mx-auto mb-1.5 text-emerald-400" />
                <div className="text-xl font-bold font-mono text-foreground">{stats.shipments}</div>
                <div className="label-meta mt-0.5">Shipments</div>
              </div>
              <div className="p-3.5 rounded-lg bg-muted/20 border border-border text-center">
                <Key className="w-4 h-4 mx-auto mb-1.5 text-indigo-400" />
                <div className="text-xl font-bold font-mono text-foreground">{stats.vehicles}</div>
                <div className="label-meta mt-0.5">Fleet Vehicles</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Documents Verification */}
        <div className="space-y-6">
          <div className="panel p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Compliance Documents
            </h2>
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No verification documents uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.documentId} className="p-3 rounded border border-border bg-muted/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase font-mono text-foreground">{doc.type.replace(/_/g, " ")}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Uploaded {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={actionModal.isOpen} onOpenChange={(open) => setActionModal({ isOpen: open, action: null })}>
        <DialogContent className="sm:max-w-md bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold capitalize">
              {actionModal.action} Tenant Organization
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to execute <span className="font-semibold text-foreground">{actionModal.action}</span> on <span className="font-medium text-foreground">{company.companyName}</span>?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-2">
            <label className="label-meta">Audit Action Note (Optional)</label>
            <Textarea
              placeholder="Provide reason or context for audit trail..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              className="h-20 text-xs bg-background border-border"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setActionModal({ isOpen: false, action: null })}>
              Cancel
            </Button>
            <Button
              variant={actionModal.action === "reject" || actionModal.action === "suspend" ? "destructive" : "default"}
              size="sm"
              disabled={submitting}
              onClick={handleAction}
              className={actionModal.action === "approve" || actionModal.action === "restore" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            >
              {submitting ? "Processing..." : `Confirm ${actionModal.action}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
