"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield, Search, ChevronLeft, ChevronRight, CalendarDays, X, RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fetchApi } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import { useUser } from "@/lib/auth-context";

interface AuditLog {
  auditId:     string;
  companyId?:  string;
  tenantName:  string;
  eventType:   string;
  description: string;
  performedBy: string;
  actorId?:    string;
  timestamp:   string;
  details?:    Record<string, unknown>;
}

interface AuditResponse {
  logs:  AuditLog[];
  total: number;
  page:  number;
  pages: number;
}

export default function GlobalAuditCenter() {
  const [logs, setLogs]     = useState<AuditLog[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [pages, setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  // Filters (server-side)
  const [searchRaw, setSearchRaw]   = useState("");
  const [eventType, setEventType]   = useState("");
  const [companyId, setCompanyId]   = useState("");
  const search = useDebounce(searchRaw, 400);

  const { user, loading: authLoading } = useUser();

  const fetchLogs = useCallback(async () => {
    if (!user) return; // Auth not ready yet
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: "50",
      });
      if (search)    params.set("search",    search);
      if (eventType) params.set("eventType", eventType);
      if (companyId) params.set("companyId", companyId);

      const res = await fetchApi(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server ${res.status}`);
      }
      const data = await res.json() as AuditResponse;
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, eventType, companyId, user]);

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1); }, [search, eventType, companyId]);

  // Gate on auth — only fetch once Firebase user is resolved
  useEffect(() => {
    if (!authLoading && user) {
      fetchLogs();
    }
  }, [fetchLogs, authLoading, user]);

  const hasFilters = searchRaw || eventType || companyId;
  const clearFilters = () => {
    setSearchRaw("");
    setEventType("");
    setCompanyId("");
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto h-[calc(100vh-theme(spacing.24))] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Global Audit Center
            </h1>
            <span className="label-meta bg-muted/40 px-2 py-0.5 rounded border border-border">
              {total} recorded {total === 1 ? "event" : "events"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Immutable cross-tenant cryptographic audit trail for compliance, security, and administrative actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1 border-border">
              <X className="w-3.5 h-3.5" /> Clear filters
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="h-8 text-xs gap-1.5 border-border">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Audit Panel */}
      <div className="panel overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Filter bar */}
        <div className="p-3.5 border-b border-border flex flex-wrap items-center gap-3 bg-muted/20">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search description, actor, event…"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              className="pl-9 h-8 text-xs bg-background border-border"
            />
          </div>

          <Input
            placeholder="Event type (e.g. company_approved)"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="h-8 w-52 bg-background border-border font-mono text-xs"
          />

          <Input
            placeholder="Tenant / company ID"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="h-8 w-44 bg-background border-border font-mono text-xs"
          />

          <Button variant="outline" size="sm" className="h-8 text-xs ml-auto opacity-50 cursor-not-allowed" disabled>
            <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            Date Range
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex items-center justify-center h-32 text-rose-400 text-xs gap-2">
              <span>{error}</span>
              <button onClick={fetchLogs} className="underline font-semibold">
                retry
              </button>
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="label-meta bg-muted/30 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-2.5 font-semibold whitespace-nowrap">Timestamp</th>
                  <th className="px-5 py-2.5 font-semibold">Tenant Scope</th>
                  <th className="px-5 py-2.5 font-semibold whitespace-nowrap">Event Type</th>
                  <th className="px-5 py-2.5 font-semibold">Description</th>
                  <th className="px-5 py-2.5 font-semibold whitespace-nowrap">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                      <div className="w-6 h-6 border-2 border-border border-t-amber-500 rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                      No audit events found matching the specified parameters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.auditId}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                        {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                      </td>
                      <td className="px-5 py-3">
                        {log.companyId && log.companyId !== "platform" ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{log.tenantName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {log.companyId}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-medium">
                            Platform Global
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/40 text-foreground border-border">
                          {log.eventType}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 max-w-md">
                        <p
                          className="truncate text-muted-foreground text-xs"
                          title={log.description}
                        >
                          {log.description || "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 border border-border px-2 py-1 rounded">
                          {log.performedBy || log.actorId || "System"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="px-5 py-2.5 border-t border-border flex items-center justify-between bg-muted/10 shrink-0">
          <div className="text-xs text-muted-foreground font-mono">
            {total > 0 ? (
              <>
                Showing <span className="font-medium text-foreground">{(page - 1) * 50 + 1}</span>–<span className="font-medium text-foreground">{Math.min(page * 50, total)}</span> of <span className="font-medium text-foreground">{total}</span> events
              </>
            ) : (
              "0 recorded events"
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-xs font-mono px-2 text-foreground">
              Page {page} of {Math.max(1, pages)}
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
