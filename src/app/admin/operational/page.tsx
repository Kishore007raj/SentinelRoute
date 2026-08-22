"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, MapPin, Truck, AlertTriangle, Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
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
  critical: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  high:     "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low:      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
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
      setError(err instanceof Error ? err.message : "Failed to load operational telemetry");
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
    <div className="space-y-6 flex flex-col h-[calc(100vh-theme(spacing.24))] max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-400" />
              Global Operational Monitor
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Stream Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time cross-tenant shipment telemetry, live dispatch state, and risk monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter tenant or shipment…"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              className="pl-9 h-8 text-xs bg-background border-border"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRoutes}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Operational Summary Bar */}
      <div className="flex items-center gap-4 shrink-0 text-xs panel px-4 py-2.5 bg-muted/20">
        <span className="text-muted-foreground">
          Total Dispatched: <span className="font-semibold font-mono text-foreground">{total}</span> active
        </span>
        <span className="text-border">|</span>
        {atRiskCount > 0 ? (
          <span className="flex items-center gap-1.5 text-rose-400 font-semibold font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            {atRiskCount} at-risk
          </span>
        ) : (
          <span className="text-emerald-400 font-medium font-mono">
            0 active disruptions
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground font-mono">
          Auto-sync: 30s interval
        </span>
      </div>

      {error && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2.5 shrink-0 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchRoutes} className="underline font-semibold ml-2">retry</button>
        </div>
      )}

      {/* Main Stream Table */}
      <div className="flex-1 min-h-0 panel flex flex-col overflow-hidden">
        <div className="p-3.5 border-b border-border bg-muted/30 shrink-0 flex items-center justify-between">
          <span className="label-meta flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            Active Route Stream
          </span>
          {loading && (
            <span className="w-3.5 h-3.5 border-2 border-border border-t-amber-500 rounded-full animate-spin" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-2">
              <Truck className="w-8 h-8 opacity-20" />
              <span>No active shipments match your filter criteria.</span>
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="label-meta bg-muted/40 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Tenant Organization</th>
                  <th className="px-4 py-2.5 font-semibold">Shipment</th>
                  <th className="px-4 py-2.5 font-semibold">Route Corridor</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Risk Index</th>
                  <th className="px-4 py-2.5 font-semibold">Driver / Asset</th>
                  <th className="px-4 py-2.5 font-semibold">Live ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((route) => (
                  <tr
                    key={route.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`font-semibold uppercase tracking-wider text-[11px] ${
                        route.tenantResolved ? "text-foreground" : "text-amber-400"
                      }`}>
                        {route.tenantName}
                        {!route.tenantResolved && (
                          <span className="ml-1 text-[9px] text-amber-500/70 normal-case font-normal">
                            (orphaned)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{route.shipmentCode ?? route.id}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{route.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-muted-foreground truncate font-mono text-[11px]">
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
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
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
                          className={`text-[10px] font-mono ${RISK_BADGE[route.riskLevel] ?? ""}`}
                        >
                          {route.riskScore !== undefined ? `${route.riskScore} · ` : ""}
                          {route.riskLevel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span>{route.assignedDriverName ?? "—"}</span>
                      {route.assignedVehicleNumber && (
                        <span className="font-mono text-[10px] ml-1 bg-muted/40 px-1.5 py-0.5 rounded border border-border">
                          {route.assignedVehicleNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                      {route.execution?.currentETA ?? route.eta ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {pages > 1 && (
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between bg-muted/10 shrink-0">
            <span className="text-xs text-muted-foreground font-mono">
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
              <span className="text-xs px-2 font-mono">{page} / {pages}</span>
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
