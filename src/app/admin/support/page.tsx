"use client";

import { useState, useCallback } from "react";
import { Wrench, Search, Shield, ActivitySquare, Building2, ExternalLink, ChevronRight, CheckCircle2, Clock, Ban, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { fetchApi } from "@/lib/api-client";
import { format } from "date-fns";

interface CompanyPreview {
  companyId:   string;
  companyName: string;
  status:      string;
  createdAt:   string;
}

export default function SupportToolsCenter() {
  // Company quick-search
  const [companySearch, setCompanySearch] = useState("");
  const [searchResults, setSearchResults] = useState<CompanyPreview[]>([]);
  const [searching, setSearching]         = useState(false);
  const [searched, setSearched]           = useState(false);

  const handleCompanySearch = useCallback(async () => {
    const q = companySearch.trim();
    if (!q) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetchApi(
        `/api/admin/companies?search=${encodeURIComponent(q)}&limit=10`
      );
      if (res.ok) {
        const data = await res.json() as { companies: CompanyPreview[] };
        setSearchResults(data.companies ?? []);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [companySearch]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "suspended":
        return <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]"><Ban className="w-3 h-3 mr-1" /> Suspended</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-muted text-muted-foreground border-border text-[10px]"><ShieldAlert className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-500" />
            Platform Support Tools
          </h1>
          <span className="label-meta bg-muted/40 px-2 py-0.5 rounded border border-border">
            Tier-3 Diagnostic Access
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Read-only inspection and investigation utilities for platform support engineering.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company quick-look */}
        <div className="panel p-6 md:col-span-2 space-y-4">
          <div>
            <span className="label-meta flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              Tenant Organization Quick-Look
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              Search by tenant name or organization ID to jump directly into the full inspection workspace.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter company name or tenant ID…"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCompanySearch()}
                className="pl-9 h-9 text-xs bg-background border-border"
              />
            </div>
            <Button
              size="sm"
              onClick={handleCompanySearch}
              disabled={searching || !companySearch.trim()}
              className="h-9 text-xs px-4"
            >
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>

          {searched && searchResults.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No tenant organizations found matching query.</p>
          )}

          {searchResults.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/50">
              {searchResults.map((co) => (
                <Link
                  key={co.companyId}
                  href={`/admin/companies/${co.companyId}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-foreground">{co.companyName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{co.companyId}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(co.status)}
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {co.createdAt ? format(new Date(co.createdAt), "MMM d, yyyy") : "—"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Audit log access */}
        <div className="panel p-6 flex flex-col justify-between">
          <div>
            <span className="label-meta flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-amber-500" />
              Platform Audit Trail
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Inspect immutable cross-tenant security logs, lifecycle transitions, and API operator records.
            </p>
          </div>
          <div className="mt-5">
            <Link href="/admin/audit">
              <Button variant="outline" className="w-full gap-2 text-xs h-9 border-border">
                <ExternalLink className="w-3.5 h-3.5" />
                Open Global Audit Center
              </Button>
            </Link>
          </div>
        </div>

        {/* Platform health access */}
        <div className="panel p-6 flex flex-col justify-between">
          <div>
            <span className="label-meta flex items-center gap-2 mb-2">
              <ActivitySquare className="w-4 h-4 text-emerald-400" />
              Infrastructure Telemetry
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Inspect live database cluster latency, connection pool capacity, and Node.js process heap memory.
            </p>
          </div>
          <div className="mt-5">
            <Link href="/admin/health">
              <Button variant="outline" className="w-full gap-2 text-xs h-9 border-border">
                <ExternalLink className="w-3.5 h-3.5" />
                Open Health Center
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Read-Only Notice */}
      <div className="panel p-4 bg-muted/10 flex items-start gap-3 text-xs text-muted-foreground border-border/80">
        <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Read-Only Diagnostic Context:</span> Support tools provide non-mutating inspection utilities. All tenant approvals, suspensions, and lifecycle modifications are audited under{" "}
          <Link href="/admin/companies" className="text-amber-500 underline hover:no-underline font-medium">
            Tenant Management
          </Link>.
        </div>
      </div>
    </div>
  );
}
