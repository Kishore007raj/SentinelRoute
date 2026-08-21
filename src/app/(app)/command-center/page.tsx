"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  AlertTriangle,
  Activity,
  Zap,
  Globe,
  Cloud,
  Navigation,
  Newspaper,
  CheckCircle2,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  ArrowRight,
  Clock,
  MapPin,
  Truck,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useStore } from "@/lib/store";
import { useUser } from "@/lib/auth-context";
import { cn, getRiskColor, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { useIntelligence } from "@/hooks/use-intelligence";
import { OperationalRecommendation } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────
interface LiveKPIs {
  highRiskShipments: number;
  activeAlerts: number;
  openIncidents: number;
  avgOperationalRisk: number;
  avgDelayProbability: number;
  avgDisruptionProbability: number;
  avgEtaConfidence: number;
  basedOnPredictions: number;
  computedAt: string;
}
type IncidentCategory = "weather" | "traffic" | "security" | "infrastructure" | "political" | "festival" | "other";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function severityColors(severity: string) {
  switch (severity) {
    case "critical":
      return { bg: "bg-red-400/10", border: "border-red-400/20", text: "text-red-400", dot: "bg-red-400" };
    case "high":
      return { bg: "bg-amber-400/10", border: "border-amber-400/20", text: "text-amber-400", dot: "bg-amber-400" };
    case "medium":
      return { bg: "bg-yellow-400/10", border: "border-yellow-400/20", text: "text-yellow-400", dot: "bg-yellow-400" };
    default:
      return { bg: "bg-blue-400/10", border: "border-blue-400/20", text: "text-blue-400", dot: "bg-blue-400" };
  }
}

// ─── Auth fetch hook ─────────────────────────────────────────────────────────
function useAuthFetch() {
  const { user } = useUser();
  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    },
    [user]
  );
}

// ─── KPI Gauge Card ──────────────────────────────────────────────────────────
function GaugeCard({
  label,
  value,
  sub,
  valueColor,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor: string;
  icon: React.ElementType;
}) {
  return (
    <div className="panel p-4 bg-card space-y-2.5 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <span className="label-meta text-[10px] leading-tight">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
      </div>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight leading-none break-words", valueColor)}>{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium line-clamp-1">{sub}</p>
    </div>
  );
}

// ─── Manual Incident Form ────────────────────────────────────────────────────
function ManualIncidentForm({ onSuccess }: { onSuccess: () => void }) {
  const authFetch = useAuthFetch();
  const [open, setOpen] = useState(false);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "other" as IncidentCategory,
    severity: "medium" as "low" | "medium" | "high" | "critical",
    latitude: "",
    longitude: "",
    recommendedAction: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setError("Latitude and longitude must be valid numbers.");
      return;
    }
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSub(true);
    try {
      const res = await authFetch("/api/intelligence/incidents", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          severity: form.severity,
          latitude: lat,
          longitude: lng,
          recommendedAction: form.recommendedAction.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to create incident.");
        return;
      }
      setOpen(false);
      setForm({
        title: "",
        description: "",
        category: "other",
        severity: "medium",
        latitude: "",
        longitude: "",
        recommendedAction: "",
      });
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSub(false);
    }
  }

  const inputCls =
    "w-full bg-muted/20 border border-border rounded-lg px-3.5 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary";

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-lg transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Plus className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Report Manual Incident</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <form onSubmit={submit} className="mt-3 panel p-5 bg-card space-y-4">
              <div className="space-y-1">
                <label className="label-meta">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Highway blocked near Pune"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="label-meta">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={2}
                  placeholder="Additional details..."
                  className={cn(inputCls, "resize-none")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="label-meta">Category</label>
                  <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                    {(["weather", "traffic", "security", "infrastructure", "political", "festival", "other"] as IncidentCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="label-meta">Severity</label>
                  <select value={form.severity} onChange={(e) => set("severity", e.target.value)} className={inputCls}>
                    {(["low", "medium", "high", "critical"] as const).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="label-meta">Latitude *</label>
                  <input value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="18.5204" className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="label-meta">Longitude *</label>
                  <input value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="73.8567" className={inputCls} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="label-meta">Recommended Action</label>
                <input
                  value={form.recommendedAction}
                  onChange={(e) => set("recommendedAction", e.target.value)}
                  placeholder="e.g. Reroute via NH66"
                  className={inputCls}
                />
              </div>
              {error && (
                <div className="bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400 font-medium">{error}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" disabled={submitting} className="flex-1 h-9 font-bold text-xs uppercase tracking-wider bg-primary text-primary-foreground">
                  {submitting ? "Submitting..." : "Submit Incident Report"}
                </Button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Intelligence Sources ─────────────────────────────────────────────────────
function IntelligenceSources({ kpis }: { kpis: LiveKPIs | null }) {
  const sources = [
    { name: "Geoapify Routing", icon: Navigation, status: "live", detail: "Autosuggest + Routing" },
    { name: "OpenWeather", icon: Cloud, status: "live", detail: "Corridor + point weather scoring" },
    { name: "TomTom Traffic", icon: Activity, status: "live", detail: "Real-time flow + incident data" },
    { name: "NewsAPI", icon: Newspaper, status: "live", detail: "Disruption signal detection" },
    {
      name: "Prediction Engine",
      icon: Zap,
      status: kpis?.basedOnPredictions ? "live" : "standby",
      detail: kpis ? `${kpis.basedOnPredictions} predictions` : "Awaiting shipments",
    },
    { name: "Festival Calendar", icon: Globe, status: "live", detail: "India-wide event registry" },
  ];
  return (
    <div className="panel p-5 bg-card space-y-4">
      <div className="flex items-center gap-2 border-b border-border/40 pb-3">
        <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
        <h3 className="text-sm font-bold text-foreground">Intelligence Feeds</h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {sources.map(({ name, icon: Icon, status, detail }) => (
          <div
            key={name}
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/50 bg-muted/10 p-3 transition-colors hover:bg-muted/20"
          >
            <div className="flex min-w-0 items-start gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  status === "live"
                    ? "border border-emerald-400/20 bg-emerald-400/10"
                    : "border border-border bg-muted/20"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    status === "live"
                      ? "text-emerald-400"
                      : "text-muted-foreground"
                  )}
                />
              </div>

              <p
                className="min-w-0 flex-1 overflow-hidden text-xs font-bold leading-snug text-foreground"
                title={name}
              >
                {name}
              </p>
            </div>

            <p className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
              {detail}
            </p>

            <div className="pt-1">
              <StatusBadge
                status={status}
                variant={status === "live" ? "success" : "inactive"}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const { kpis, incidents, alerts, loadingKpis, loadingIncidents, loadingAlerts, refresh, kpisAvailable, alertsAvailable, incidentsAvailable } = useIntelligence({
    fetchKpis: true,
    fetchAlerts: true,
    fetchIncidents: true,
  });
  const kpisLoading = loadingKpis;
  const threatLoading = loadingIncidents || loadingAlerts;
  const { atRiskShipments, activeShipments, operationalFeed } = useStore();

  const activeRecommendations = useMemo(() => {
    const feed = operationalFeed as { recommendations?: OperationalRecommendation[] } | null;
    if (!feed?.recommendations) return [];
    return feed.recommendations
      .filter((r: OperationalRecommendation) => r.lifecycleStatus === "generated" || r.status === "pending" || r.lifecycleStatus === "viewed")
      .sort((a: OperationalRecommendation, b: OperationalRecommendation) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [operationalFeed]);

  const { threatFeed, criticalCount, highCount } = useMemo(() => {
    const feed = [
      ...incidents.map((i) => ({
        id: i.incidentId,
        title: i.title,
        severity: i.severity,
        time: i.lastUpdated,
        sub: i.category,
        action: i.recommendedAction,
      })),
      ...alerts.map((a) => ({
        id: a.alertId,
        title: a.reason,
        severity: a.severity,
        time: a.timestamp,
        sub: `Shipment ${a.shipmentId.slice(-8)}`,
        action: a.recommendedAction,
      })),
    ].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
    });
    const crit = feed.filter((t) => t.severity === "critical").length;
    const high = feed.filter((t) => t.severity === "high").length;
    return { threatFeed: feed, criticalCount: crit, highCount: high };
  }, [incidents, alerts]);

  function handleRefresh() {
    refresh();
  }

  // Derived Analytics
  const { topCorridors, delayedShipments } = useMemo(() => {
    const riskMap = new Map<string, { total: number; count: number }>();
    activeShipments.forEach((s) => {
      const key = `${s.origin} to ${s.destination}`;
      const curr = riskMap.get(key) || { total: 0, count: 0 };
      curr.total += s.riskScore;
      curr.count += 1;
      riskMap.set(key, curr);
    });
    const top = Array.from(riskMap.entries())
      .map(([key, { total, count }]) => ({ name: key, avgRisk: Math.round(total / count) }))
      .sort((a, b) => b.avgRisk - a.avgRisk)
      .slice(0, 3);

    const delayed = [...activeShipments].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);

    return { topCorridors: top, delayedShipments: delayed };
  }, [activeShipments]);

  return (
    <div className="max-w-7xl mx-auto w-full space-y-7 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <p className="label-meta flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-primary" />
            Operational Intelligence & Threat Coordination
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Command Center</h1>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9 px-3.5 text-xs font-bold uppercase tracking-wider gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Intelligence
        </Button>
      </div>

      {/* Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GaugeCard
          label="Active Alerts"
          value={kpisLoading ? "—" : String(kpis?.activeAlerts ?? atRiskShipments.length)}
          sub="Requires operator review"
          valueColor="text-amber-400"
          icon={AlertTriangle}
        />
        <GaugeCard
          label="Open Incidents"
          value={kpisLoading ? "—" : String(kpis?.openIncidents ?? criticalCount)}
          sub={`${criticalCount} critical severity`}
          valueColor="text-red-400"
          icon={ShieldAlert}
        />
        <GaugeCard
          label="Avg Disruption Risk"
          value={kpisLoading ? "—" : `${Math.min(100, Math.round((kpis?.avgDisruptionProbability ?? 0.24) * 100))}%`}
          sub="Corridor disruption index"
          valueColor="text-primary"
          icon={Zap}
        />
        <GaugeCard
          label="ETA Confidence"
          value={kpisLoading ? "—" : `${Math.min(100, Math.round((kpis?.avgEtaConfidence ?? 0.88) * 100))}%`}
          sub="Realtime tracking model"
          valueColor="text-emerald-400"
          icon={CheckCircle2}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Unavailable Message */}
        {!kpisAvailable && !alertsAvailable && !incidentsAvailable && (
          <div className="lg:col-span-12 bg-amber-400/10 border border-amber-400/20 rounded-lg p-4">
            <p className="text-sm text-amber-400 font-medium">
              Intelligence features are not available for your account type. This view is designed for administrators. Please visit your user dashboard for available features.
            </p>
          </div>
        )}

        {/* Left Column (8 cols): Threat Feed & Recommendations */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Threat Feed */}
          {(alertsAvailable || incidentsAvailable) && (
            <div className="panel p-5 bg-card space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Active Threat & Disruption Feed</h3>
                  <p className="text-[11px] text-muted-foreground">Merged live incidents & shipment risk alerts</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="label-meta">{threatFeed.length} active</span>
                </div>
              </div>

              {threatLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading threat intelligence…</div>
              ) : threatFeed.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">No critical disruptions or active alerts logged.</div>
              ) : (
                <div className="space-y-3">
                  {threatFeed.map((t) => {
                    const s = severityColors(t.severity);
                    return (
                      <div key={t.id} className={cn("panel p-4 bg-muted/5 space-y-2 border", s.border)}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", s.dot)} />
                            <p className="text-xs font-bold text-foreground truncate">{t.title}</p>
                          </div>
                          <span className={cn("text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border shrink-0", s.bg, s.text, s.border)}>
                            {t.severity}
                          </span>
                        </div>
                        {t.action && <p className="text-[11px] text-muted-foreground leading-relaxed">Action: {t.action}</p>}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 pt-1 border-t border-border/30">
                          <span className="uppercase tracking-wider">{t.sub}</span>
                          <span>{formatRelativeTime(t.time)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Active Recommendations */}
          <div className="panel p-5 bg-card space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Operational Reroute Recommendations</h3>
                <p className="text-[11px] text-muted-foreground">AI predictive decision suggestions</p>
              </div>
              <Link href="/route-intelligence">
                <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-wider px-2.5">
                  Route Workspace <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>

            {activeRecommendations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No pending reroute recommendations.</p>
            ) : (
              <div className="space-y-3">
                {activeRecommendations.slice(0, 3).map((r) => (
                  <div key={r.recommendationId} className="panel p-4 bg-muted/5 space-y-2 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Reroute Recommendation</span>
                      <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {r.status || r.lifecycleStatus}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Manual Incident & Intelligence Sources */}
        <div className="lg:col-span-4 space-y-6">
          <ManualIncidentForm onSuccess={handleRefresh} />
          <IntelligenceSources kpis={kpis} />
        </div>
      </div>
    </div>
  );
}
