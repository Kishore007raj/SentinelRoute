"use client";

/**
 * Support & Developer Tools
 *
 * Provides read-only inspection utilities for L3 support.
 * No fake "biometric" or "CLI" UI — only real capabilities.
 *
 * Available tools:
 *   1. Audit log search (links to /admin/audit with pre-filled query)
 *   2. Company quick-look (search + link to /admin/companies/[id])
 *   3. Platform health link (links to /admin/health)
 *   4. Super-admin seed utility (for bootstrapping the platform)
 *
 * No mutations are performed from this page.
 */

import { useState, useCallback } from "react";
import { Wrench, Search, Shield, ActivitySquare, Building2, ExternalLink, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

const STATUS_CLASS: Record<string, string> = {
  approved:  "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  pending:   "bg-amber-500/10 text-amber-500 border-amber-500/20",
  suspended: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  rejected:  "bg-muted text-muted-foreground border-border",
};

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wrench className="w-6 h-6 text-stone-400" />
          Support Tools
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only inspection utilities for L3 platform support.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Company quick-look ─────────────────────────────────────────── */}
        <Card className="border-border/50 shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-blue-500" />
              Company Quick-Look
            </CardTitle>
            <CardDescription>
              Search for a tenant by name or ID to jump directly to their inspection page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Company name or ID…"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCompanySearch()}
                  className="pl-9 h-9"
                />
              </div>
              <Button
                size="sm"
                onClick={handleCompanySearch}
                disabled={searching || !companySearch.trim()}
                className="h-9"
              >
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>

            {searched && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">No tenants found matching that query.</p>
            )}

            {searchResults.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                {searchResults.map((co, i) => (
                  <Link
                    key={co.companyId}
                    href={`/admin/companies/${co.companyId}`}
                    className={`flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors ${
                      i > 0 ? "border-t border-border/50" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{co.companyName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{co.companyId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${STATUS_CLASS[co.status] ?? ""}`}
                      >
                        {co.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {co.createdAt ? format(new Date(co.createdAt), "MMM d, yyyy") : "—"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Audit log quick-access ─────────────────────────────────────── */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-amber-500" />
              Audit Log Access
            </CardTitle>
            <CardDescription>
              View the immutable platform-wide audit trail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/audit">
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="w-4 h-4" />
                Open Audit Center
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* ── Platform health quick-access ───────────────────────────────── */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivitySquare className="w-4 h-4 text-emerald-500" />
              Platform Health
            </CardTitle>
            <CardDescription>
              Inspect live infrastructure telemetry and database status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/health">
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="w-4 h-4" />
                Open Health Center
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>

      {/* Notice */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-500/90">
        <strong>Read-only mode.</strong> Support tools provide inspection access only.
        All administrative mutations (approve, suspend, reject) are performed from the{" "}
        <Link href="/admin/companies" className="underline hover:no-underline">
          Tenant Management
        </Link>{" "}
        page and are audited.
      </div>
    </div>
  );
}
