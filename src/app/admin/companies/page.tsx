"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, CheckCircle2, Clock, Ban, ShieldAlert } from "lucide-react";
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
        setCompanies(data.companies);
        setTotal(data.total);
        setPages(data.pages);
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
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/15"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/15"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "suspended":
        return <Badge variant="secondary" className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/15"><Ban className="w-3 h-3 mr-1" /> Suspended</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-muted text-muted-foreground border-border hover:bg-muted/80"><ShieldAlert className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenant Management</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage SentinelRoute platform tenants.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center gap-4 bg-muted/20">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search companies by name or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 w-full bg-background border-border"
            />
          </div>
          <div className="w-full sm:w-[180px]">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val || "all"); setPage(1); }}>
              <SelectTrigger className="h-9 bg-background border-border">
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">Company</th>
                <th className="px-6 py-3 font-semibold">Admin Email</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Joined Date</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-border border-t-amber-500 rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No companies found matching your criteria.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.companyId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{company.companyName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{company.companyId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {company.adminUserEmail || <span className="italic opacity-50">No admin found</span>}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(company.status)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {company.createdAt ? format(new Date(company.createdAt), "MMM d, yyyy") : "Unknown"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/companies/${company.companyId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hover:bg-amber-500/10 hover:text-amber-500")}>
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/10">
            <div className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(page - 1) * 10 + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * 10, total)}</span> of <span className="font-medium text-foreground">{total}</span> tenants
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
              <div className="text-xs font-medium px-2">
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
