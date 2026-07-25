"use client";

import { useEffect, useState } from "react";
import { Shield, Search, Filter, ChevronLeft, ChevronRight, Activity, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function GlobalAuditCenter() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        // In a real app we might pass companyId or eventType from state
        const res = await fetch(`/api/admin/audit?page=${page}&limit=50`);
        if (!res.ok) throw new Error("Failed to load audit logs");
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
        setPages(data.pages);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [page]);

  const filteredLogs = search
    ? logs.filter(l => 
        l.tenantName.toLowerCase().includes(search.toLowerCase()) || 
        l.eventType.toLowerCase().includes(search.toLowerCase()) ||
        l.description?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto h-[calc(100vh-theme(spacing.24))] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-500" />
            Global Audit Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cross-tenant immutable audit log of all system actions.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center gap-4 bg-muted/20">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Filter by tenant, event, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-full bg-background border-border"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="h-9">
              <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
              Date Range
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              Filters
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-semibold">Timestamp</th>
                <th className="px-6 py-3 font-semibold">Tenant</th>
                <th className="px-6 py-3 font-semibold">Event Type</th>
                <th className="px-6 py-3 font-semibold">Description</th>
                <th className="px-6 py-3 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-border border-t-amber-500 rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No audit logs found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs font-mono">
                      {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                    </td>
                    <td className="px-6 py-4">
                      {log.companyId ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{log.tenantName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{log.companyId}</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">System Platform</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {log.eventType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <p className="truncate text-muted-foreground" title={log.description}>
                        {log.description}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded-md">
                        {log.performedBy || "System"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/10 shrink-0">
            <div className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(page - 1) * 50 + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * 50, total)}</span> of <span className="font-medium text-foreground">{total}</span> events
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon-sm" 
                disabled={page === 1 || loading}
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
                disabled={page === pages || loading}
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
