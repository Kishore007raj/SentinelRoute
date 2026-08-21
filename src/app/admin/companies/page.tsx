"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, CheckCircle2, Clock, Ban, ShieldAlert, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { format } from "date-fns";
import { fetchApi } from "@/lib/api-client";
import { useUser } from "@/lib/auth-context";
import { Company } from "@/lib/types";

export default function TenantManagementPage() {
  const [companies, setCompanies] = useState<(Company & { adminUserEmail?: string })[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { user, loading: authLoading } = useUser();

  useEffect(() => {
    if (authLoading || !user) return; // Wait for Firebase auth

    const fetchCompanies = async () => {
      setLoading(true);
      try {
        const res = await fetchApi(`/api/admin/companies?page=${page}&limit=10&search=${encodeURIComponent(search)}&status=${statusFilter}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setCompanies(data.companies ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchCompanies();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [page, search, statusFilter, authLoading, user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px]"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "suspended":
        return <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[11px]"><Ban className="w-3 h-3 mr-1" /> Suspended</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-muted text-muted-foreground border-border text-[11px]"><ShieldAlert className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Tenant Management</h1>
            <span className="label-meta bg-muted/40 px-2 py-0.5 rounded border border-border">
              {total} registered {total === 1 ? "tenant" : "tenants"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Global lifecycle administration and organizational verification for platform clients.
          </p>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="panel overflow-hidden flex flex-col">
        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center gap-3 bg-muted/20">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search companies by name or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 w-full bg-background border-border text-xs"
            />
          </div>
          <div className="w-full sm:w-[180px]">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val || "all"); setPage(1); }}>
              <SelectTrigger className="h-9 bg-background border-border text-xs">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="label-meta bg-muted/30 border-b border-border">
              <tr>
                <th className="px-5 py-3 font-semibold">Tenant Organization</th>
                <th className="px-5 py-3 font-semibold">Admin Account</th>
                <th className="px-5 py-3 font-semibold">Lifecycle Status</th>
                <th className="px-5 py-3 font-semibold">Registration Date</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading && companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-border border-t-amber-500 rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                    <Building2 className="w-8 h-8 opacity-20 mx-auto mb-2" />
                    No tenant organizations found matching the criteria.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.companyId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground text-sm">{company.companyName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{company.companyId}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground font-mono">
                      {company.adminUserEmail || <span className="italic opacity-50 font-sans">No admin found</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {getStatusBadge(company.status)}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground font-mono">
                      {company.createdAt ? format(new Date(company.createdAt), "MMM d, yyyy") : "Unknown"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/companies/${company.companyId}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-7 px-2.5 text-xs hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-500"
                        )}
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/10">
            <div className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground font-mono">{(page - 1) * 10 + 1}</span> to <span className="font-medium text-foreground font-mono">{Math.min(page * 10, total)}</span> of <span className="font-medium text-foreground font-mono">{total}</span> tenants
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon-sm" 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-xs font-mono px-2 text-foreground">
                Page {page} of {pages}
              </div>
              <Button 
                variant="outline" 
                size="icon-sm" 
                disabled={page === pages}
                onClick={() => setPage(p => Math.min(pages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
