"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, MapPin, Truck, AlertTriangle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchApi } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import { useUser } from "@/lib/auth-context";

interface ShipmentExecution {
  status:           string;
  averageSpeed?:    number;
  lastKnownLocation?: { lat: number; lng: number; updatedAt: string };
  currentETA?:      string;
  travelledDistance?: number;
  remainingDistance?: number;
  lastUpdated?:     string;
}

interface ActiveRoute {
  id:                   string;
  shipmentCode?:        string;
  companyId:            string;
  tenantName:           string;
  tenantResolved:       boolean;
  status:               string;
  origin?:              string;
  originName?:          string;
  destination?:         string;
  destinationName?:     string;
  riskScore?:           number;
  riskLevel?:           string;
  eta?:                 string;
  assignedDriverName?:  string;
  assignedVehicleNumber?: string;
  execution:            ShipmentExecution | null;
}

interface OperationalResponse {
  activeRoutes: ActiveRoute[];
  total:        number;
  page:         number;
  pages:        number;
}

const RISK_BADGE: Record<string, string> = {
  critical: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  high:     "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium:   "bg-amber-500/10 text-amber-500 border-amber-500/20",
  low:      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export default function GlobalOperationalMonitor() {
  const [routes, setRoutes]     = useState<ActiveRoute[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const { user, loading: authLoading } = useUser();

  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 350);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      // Pass search as companyId filter if it looks like an ID, else just display-filter
      const res = await fetchApi(`/api/admin/operational?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server ${res.status}`);
      }
      const data = await res.json() as OperationalResponse;
      setRoutes(data.activeRoutes ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operational data");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!authLoading && user) fetchRoutes();
  }, [authLoading, user, fetchRoutes]);

  // Auto-refresh every 30 s
  useEffect(() => {
    const interval = setInterval(fetchRoutes, 30_000);
    return () => clearInterval(interval);
  }, [fetchRoutes]);

  // Client-side filter by tenant name or shipment code (already server-paginated)
  const filtered = search
    ? routes.filter(
        (r) =>
          r.tenantName.toLowerCase().includes(search.toLowerCase()) ||
          (r.id ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (r.shipmentCode ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : routes;

  const atRiskCount = routes.filter((r) => r.status === "at-risk").length;

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-theme(spacing.24))]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-500" />
            Global Operational Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-tenant active shipments with execution state.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter tenant or shipment…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 shrink-0 text-sm">
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> active shipments
        </span>
        {atRiskCount > 0 && (
          <span className="flex items-center gap-1.5 text-rose-500 font-medium">
            <AlertTriangle className="w-4 h-4" />
            {atRiskCount} at-risk
          </span>
        )}
        <span className="ml-auto">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </span>
        <span className="text-xs text-muted-foreground">Live · refreshes every 30s</span>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3 shrink-0">
          {error} —{" "}
          <button onClick={fetchRoutes} className="underline">retry</button>
        </div>
      )}

      {/* Route list */}
      <div className="flex-1 min-h-0 bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 shrink-0">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Active Route Stream
            {loading && (
              <span className="w-4 h-4 border-2 border-border border-t-indigo-500 rounded-full animate-spin ml-2" />
            )}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
              <Truck className="w-8 h-8 opacity-20" />
              <span>No active shipments match your search.</span>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tenant</th>
                  <th className="px-4 py-3 font-semibold">Shipment</th>
                  <th className="px-4 py-3 font-semibold">Route</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Risk</th>
                  <th className="px-4 py-3 font-semibold">Driver / Vehicle</th>
                  <th className="px-4 py-3 font-semibold">ETA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((route) => (
                  <tr
                    key={route.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${
                        route.tenantResolved ? "text-indigo-400" : "text-amber-500"
                      }`}>
                        {route.tenantName}
                        {!route.tenantResolved && (
                          <span className="ml-1 text-[10px] text-amber-500/70 normal-case font-normal">
                            (orphaned)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">{route.shipmentCode ?? route.id}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{route.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-xs text-muted-foreground truncate">
                        {route.originName ?? route.origin ?? "—"}
                        {" → "}
                        {route.destinationName ?? route.destination ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          route.status === "at-risk"
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px]"
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]"
                        }
                      >
                        {route.status === "at-risk" ? (
                          <AlertTriangle className="w-3 h-3 mr-1" />
                        ) : (
                          <Truck className="w-3 h-3 mr-1" />
                        )}
                        {route.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {route.riskLevel ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${RISK_BADGE[route.riskLevel] ?? ""}`}
                        >
                          {route.riskScore !== undefined ? `${route.riskScore} ` : ""}
                          {route.riskLevel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {route.assignedDriverName ?? "—"}
                      {route.assignedVehicleNumber && (
                        <span className="font-mono ml-1">· {route.assignedVehicleNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {route.execution?.currentETA ?? route.eta ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-muted/10 shrink-0">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs px-2">{page} / {pages}</span>
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
        )}
      </div>
    </div>
  );
}
