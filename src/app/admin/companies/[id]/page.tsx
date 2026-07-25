"use client";

import { useState, useEffect, use, useCallback } from "react";
import { ArrowLeft, Building2, ShieldAlert, CheckCircle2, Clock, Ban, Users, Package, Truck, Key, Activity, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CompanyInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; action: string | null }>({ isOpen: false, action: null });
  const [actionNote, setActionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCompanyData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/companies/${id}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load company details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  const handleAction = async () => {
    if (!actionModal.action) return;
    
    try {
      setSubmitting(true);
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionModal.action, note: actionNote })
      });
      
      if (!res.ok) throw new Error("Failed to perform action");
      
      toast.success(`Company ${actionModal.action}d successfully`);
      setActionModal({ isOpen: false, action: null });
      setActionNote("");
      await fetchCompanyData();
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-border border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.company) {
    return (
      <div className="p-6 text-center text-destructive">
        Company not found
      </div>
    );
  }

  const { company, documents, stats } = data;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      case "suspended":
        return <Badge variant="secondary" className="bg-rose-500/10 text-rose-500 border-rose-500/20"><Ban className="w-3 h-3 mr-1" /> Suspended</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-muted text-muted-foreground border-border"><ShieldAlert className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/admin/companies" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "hover:bg-accent -ml-2")}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{company.companyName}</h1>
            {getStatusBadge(company.status)}
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">ID: {company.companyId}</p>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          {company.status === "pending" && (
            <>
              <Button variant="destructive" onClick={() => setActionModal({ isOpen: true, action: "reject" })}>Reject</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setActionModal({ isOpen: true, action: "approve" })}>Approve Tenant</Button>
            </>
          )}
          {company.status === "approved" && (
            <Button variant="destructive" onClick={() => setActionModal({ isOpen: true, action: "suspend" })}>Suspend Tenant</Button>
          )}
          {company.status === "suspended" && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setActionModal({ isOpen: true, action: "restore" })}>Restore Access</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              Company Profile
            </h2>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider font-semibold">Primary Contact</p>
                <p className="font-medium">{company.contactName}</p>
                <p className="text-muted-foreground">{company.email}</p>
                <p className="text-muted-foreground">{company.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider font-semibold">Address</p>
                <p className="font-medium">{company.address?.street}</p>
                <p className="text-muted-foreground">{company.address?.city}, {company.address?.state} {company.address?.zipCode}</p>
                <p className="text-muted-foreground">{company.address?.country}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider font-semibold">Tax ID / EIN</p>
                <p className="font-medium font-mono">{company.taxId || "Not provided"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wider font-semibold">Registration Date</p>
                <p className="font-medium">{company.createdAt ? format(new Date(company.createdAt), "PPP p") : "Unknown"}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              Platform Usage Stats
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/40 border border-border/50 text-center">
                <Users className="w-5 h-5 mx-auto mb-2 text-indigo-500" />
                <div className="text-2xl font-bold">{stats.users}</div>
                <div className="text-xs text-muted-foreground mt-1">Users</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/40 border border-border/50 text-center">
                <Truck className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                <div className="text-2xl font-bold">{stats.drivers}</div>
                <div className="text-xs text-muted-foreground mt-1">Drivers</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/40 border border-border/50 text-center">
                <Package className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                <div className="text-2xl font-bold">{stats.shipments}</div>
                <div className="text-xs text-muted-foreground mt-1">Shipments</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/40 border border-border/50 text-center">
                <Key className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                <div className="text-2xl font-bold">{stats.vehicles}</div>
                <div className="text-xs text-muted-foreground mt-1">Vehicles</div>
              </div>
            </div>
          </div>
        </div>

        {/* Documents Side */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col h-full">
            <div className="p-5 border-b border-border bg-muted/20">
              <h2 className="font-semibold">Verification Documents</h2>
            </div>
            <div className="p-5 flex-1">
              {documents && documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc: { documentId: string; type: string; uploadedAt: string; fileUrl?: string }) => (
                    <div key={doc.documentId} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{doc.type}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
                      </div>
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm py-12 text-center">
                  <ShieldAlert className="w-8 h-8 mb-3 opacity-20" />
                  <p>No verification documents uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={actionModal.isOpen} onOpenChange={(open) => !open && setActionModal({ isOpen: false, action: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionModal.action} Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to {actionModal.action} this tenant? This action will be audited.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Audit Note (Required)</label>
            <Textarea 
              placeholder={`Reason for ${actionModal.action}ing...`}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal({ isOpen: false, action: null })} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              variant={actionModal.action === "approve" || actionModal.action === "restore" ? "default" : "destructive"} 
              onClick={handleAction}
              disabled={submitting || !actionNote.trim()}
              className={actionModal.action === "approve" || actionModal.action === "restore" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {submitting ? "Processing..." : `Confirm ${actionModal.action}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
