"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, AlertTriangle, Activity, Zap, Globe, Cloud,
  Navigation, Newspaper, CheckCircle2, RefreshCw, Plus, X,
  ChevronDown, ArrowRight, Clock, TrendingUp, MapPin, Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useUser } from "@/lib/auth-context";
import { cn, getRiskColor, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

// --- Types ---
interface LiveKPIs {
  highRiskShipments:        number;
  activeAlerts:             number;
  openIncidents:            number;
  avgOperationalRisk:       number;
  avgDelayProbability:      number;
  avgDisruptionProbability: number;
  avgEtaConfidence:         number;
  basedOnPredictions:       number;
  computedAt:               string;
}
interface LiveIncident {
  incidentId:       string;
  title:            string;
  description:      string;
  category:         string;
  severity:         "low" | "medium" | "high" | "critical";
  latitude:         number;
  longitude:        number;
  startTime:        string;
  lastUpdated:      string;
  source:           string;
  impactScore:      number;
  recommendedAction?: string;
}
interface LiveAlert {
  alertId:           string;
  reason:            string;
  recommendedAction: string;
  severity:          string;
  timestamp:         string;
  shipmentId:        string;
}
type IncidentCategory = "weather" | "traffic" | "security" | "infrastructure" | "political" | "festival" | "other";

// --- Helpers ---
function severityColors(severity: string) {
  switch (severity) {
    case "critical": return { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", dot: "bg-red-500" };
    case "high":     return { bg: "bg-amber-400/10", border: "border-amber-400/30", text: "text-amber-400", dot: "bg-amber-400" };
    case "medium":   return { bg: "bg-yellow-400/10", border: "border-yellow-400/30", text: "text-yellow-400", dot: "bg-yellow-400" };
    default:         return { bg: "bg-blue-400/10", border: "border-blue-400/30", text: "text-blue-400", dot: "bg-blue-400" };
  }
}

// --- Auth fetch hook ---
function useAuthFetch() {
  const { user } = useUser();
  return useCallback(async (url: string, options: RequestInit = {}) => {
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
  }, [user]);
}

// --- KPI hook ---
function useLiveKPIs() {
  const authFetch = useAuthFetch();
  const [kpis, setKpis]       = useState<LiveKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted               = useRef(true);
  const load = useCallback(async () => {
    try {
      const res = await authFetch("/api/intelligence/kpis");
      if (res.ok && mounted.current) setKpis(await res.json());
    } catch { /* silent */ }
    finally { if (mounted.current) setLoading(false); }
  }, [authFetch]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const id = setInterval(() => { void load(); }, 90_000);
    return () => { mounted.current = false; clearInterval(id); };
  }, [load]);
  return { kpis, loading, refresh: load };
}

// --- Incidents + alerts hook ---
function useLiveIncidents() {
  const authFetch = useAuthFetch();
  const [incidents, setIncidents] = useState<LiveIncident[]>([]);
  const [alerts, setAlerts]       = useState<LiveAlert[]>([]);
  const [loading, setLoading]     = useState(true);
  const mounted                   = useRef(true);
  const load = useCallback(async () => {
    try {
      const [incRes, alertRes] = await Promise.all([
        authFetch("/api/intelligence/incidents"),
        authFetch("/api/intelligence/alerts"),
      ]);
      if (!mounted.current) return;
      if (incRes.ok)   { const d = await incRes.json();   setIncidents(d.incidents ?? []); }
      if (alertRes.ok) { const d = await alertRes.json(); setAlerts(d.alerts ?? []); }
    } catch { /* silent */ }
    finally { if (mounted.current) setLoading(false); }
  }, [authFetch]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const id = setInterval(() => { void load(); }, 60_000);
    return () => { mounted.current = false; clearInterval(id); };
  }, [load]);
  return { incidents, alerts, loading, refresh: load };
}

// --- KPI Gauge Card ---
function GaugeCard({ label, value, sub, valueColor, icon: Icon }: {
  label: string; value: string; sub: string; valueColor: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
        <Icon className="w-4 h-4 text-muted-foreground/40" />
      </div>
      <p className={cn("text-4xl font-bold tabular-nums leading-none", valueColor)}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// --- Manual Incident Form ---
function ManualIncidentForm({ onSuccess }: { onSuccess: () => void }) {
  const authFetch = useAuthFetch();
  const [open, setOpen]      = useState(false);
  const [submitting, setSub] = useState(false);
  const [error, setError]    = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "other" as IncidentCategory,
    severity: "medium" as "low" | "medium" | "high" | "critical",
    latitude: "", longitude: "", recommendedAction: "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (isNaN(lat) || isNaN(lng)) { setError("Latitude and longitude must be valid numbers."); return; }
    if (!form.title.trim())       { setError("Title is required."); return; }
    setSub(true);
    try {
      const res = await authFetch("/api/intelligence/incidents", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(), description: form.description.trim(),
          category: form.category, severity: form.severity,
          latitude: lat, longitude: lng,
          recommendedAction: form.recommendedAction.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to create incident."); return;
      }
      setOpen(false);
      setForm({ title: "", description: "", category: "other", severity: "medium", latitude: "", longitude: "", recommendedAction: "" });
      onSuccess();
    } catch { setError("Network error. Please try again."); }
    finally { setSub(false); }
  }

  const inputCls = "w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl transition-colors text-left">
        <div className="flex items-center gap-3">
          <Plus className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Report Manual Incident</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <form onSubmit={submit} className="mt-3 bg-card border border-border rounded-xl p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-widest">Title *</label>
                <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Highway blocked near Pune" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-widest">Description</label>
                <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Additional details..." className={inputCls + " resize-none"} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-widest">Category</label>
                  <select value={form.category} onChange={e => set("category", e.target.value)} className={inputCls}>
                    {(["weather","traffic","security","infrastructure","political","festival","other"] as IncidentCategory[]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-widest">Severity</label>
                  <select value={form.severity} onChange={e => set("severity", e.target.value)} className={inputCls}>
                    {(["low","medium","high","critical"] as const).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-widest">Latitude *</label>
                  <input value={form.latitude} onChange={e => set("latitude", e.target.value)} placeholder="18.5204" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-widest">Longitude *</label>
                  <input value={form.longitude} onChange={e => set("longitude", e.target.value)} placeholder="73.8567" className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-widest">Recommended Action</label>
                <input value={form.recommendedAction} onChange={e => set("recommendedAction", e.target.value)} placeholder="e.g. Reroute via NH66" className={inputCls} />
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3"><p className="text-xs text-red-400">{error}</p></div>}
              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={submitting} className="flex-1 h-11 font-semibold">
                  {submitting ? "Submitting..." : "Submit Incident Report"}
                </Button>
                <button type="button" onClick={() => setOpen(false)} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Intelligence Sources ---
function IntelligenceSources({ kpis }: { kpis: LiveKPIs | null }) {
  const sources = [
    { name: "Mappls Routing", icon: Navigation, status: "live", detail: "Autosuggest + Distance Matrix" },
    { name: "OpenWeather", icon: Cloud, status: "live", detail: "Corridor + point weather scoring" },
    { name: "TomTom Traffic", icon: Activity, status: "live", detail: "Real-time flow + incident data" },
    { name: "NewsAPI", icon: Newspaper, status: "live", detail: "Disruption signal detection" },
    { name: "Prediction Engine", icon: Zap, status: kpis?.basedOnPredictions ? "live" : "standby", detail: kpis ? `${kpis.basedOnPredictions} predictions` : "Awaiting shipments" },
    { name: "Festival Calendar", icon: Globe, status: "live", detail: "India-wide event registry" },
  ];
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Intelligence Sources</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sources.map(({ name, icon: Icon, status, detail }) => (
          <div key={name} className="flex items-start gap-3 p-4 bg-muted/5 border border-border/50 rounded-xl">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              status === "live" ? "bg-emerald-400/10 border border-emerald-400/20" : "bg-muted/20 border border-border")}>
              <Icon className={cn("w-4 h-4", status === "live" ? "text-emerald-400" : "text-muted-foreground")} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{detail}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={cn("inline-block w-1.5 h-1.5 rounded-full", status === "live" ? "bg-emerald-400" : "bg-muted-foreground")} />
                <span className={cn("text-[10px] uppercase tracking-widest font-medium", status === "live" ? "text-emerald-400" : "text-muted-foreground")}>{status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Page ---
export default function CommandCenterPage() {
  const { kpis, loading: kpisLoading, refresh: refreshKPIs } = useLiveKPIs();
  const { incidents, alerts, loading: threatLoading, refresh: refreshThreats } = useLiveIncidents();
  const { atRiskShipments, activeShipments } = useStore();

  const { threatFeed, criticalCount, highCount } = useMemo(() => {
    const feed = [
      ...incidents.map(i => ({ id: i.incidentId, title: i.title, severity: i.severity, time: i.lastUpdated, sub: i.category, action: i.recommendedAction })),
      ...alerts.map(a => ({ id: a.alertId, title: a.reason, severity: a.severity, time: a.timestamp, sub: `Shipment ${a.shipmentId.slice(-8)}`, action: a.recommendedAction })),
    ].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
    });
    const crit = feed.filter(t => t.severity === "critical").length;
    const high = feed.filter(t => t.severity === "high").length;
    return { threatFeed: feed, criticalCount: crit, highCount: high };
  }, [incidents, alerts]);

  function handleRefresh() { refreshKPIs(); refreshThreats(); }

  // Derived Analytics
  const { topCorridors, delayedShipments } = useMemo(() => {
    const riskMap = new Map<string, { total: number, count: number }>();
    activeShipments.forEach(s => {
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

    const delayed = [...activeShipments]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 3);

    return { topCorridors: top, delayedShipments: delayed };
  }, [activeShipments]);

  return (
    <div className="max-w-7xl mx-auto w-full space-y-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b border-border">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Operational Intelligence</p>
              <h1 className="text-3xl font-bold text-foreground leading-tight">Command Center</h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pl-12">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Live data - refreshes every 60-90s
            </div>
            {criticalCount > 0 && <span className="text-red-400 font-semibold">{criticalCount} CRITICAL</span>}
            {highCount > 0 && <span className="text-amber-400 font-semibold">{highCount} HIGH</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 border border-border rounded-lg hover:bg-accent transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Link href="/company/intelligence/incidents">
            <Button variant="outline" className="gap-2 h-10">
              <AlertTriangle className="w-4 h-4" /> Incident Center
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Gauges */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Live KPIs</h2>
          {kpis?.computedAt && (
            <span className="text-[10px] text-muted-foreground/60 ml-auto">
              computed {formatRelativeTime(kpis.computedAt)}{kpis.basedOnPredictions > 0 && ` from ${kpis.basedOnPredictions} predictions`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GaugeCard label="High-Risk Shipments" value={kpisLoading && !kpis ? "..." : String(kpis?.highRiskShipments ?? "--")} sub={kpis ? `${kpis.openIncidents} open incidents` : "loading"} valueColor={(kpis?.highRiskShipments ?? 0) > 0 ? "text-red-400" : "text-emerald-400"} icon={AlertTriangle} />
          <GaugeCard label="Avg Delay Probability" value={kpisLoading && !kpis ? "..." : kpis ? `${kpis.avgDelayProbability}%` : "--"} sub={kpis ? `${kpis.basedOnPredictions} predictions` : "loading"} valueColor={(kpis?.avgDelayProbability ?? 0) > 40 ? "text-amber-400" : "text-emerald-400"} icon={Clock} />
          <GaugeCard label="Disruption Risk" value={kpisLoading && !kpis ? "..." : kpis ? `${kpis.avgDisruptionProbability}%` : "--"} sub={kpis ? (kpis.avgDisruptionProbability > 30 ? "elevated" : "within range") : "loading"} valueColor={(kpis?.avgDisruptionProbability ?? 0) > 30 ? "text-amber-400" : "text-emerald-400"} icon={Activity} />
          <GaugeCard label="ETA Confidence" value={kpisLoading && !kpis ? "..." : kpis ? `${kpis.avgEtaConfidence}%` : "--"} sub={kpis ? `${kpis.activeAlerts} active alerts` : "loading"} valueColor={(kpis?.avgEtaConfidence ?? 100) < 70 ? "text-amber-400" : "text-emerald-400"} icon={CheckCircle2} />
        </div>
      </div>

      {/* Analytics Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Risky Corridors */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Top Risky Corridors</h3>
          </div>
          {topCorridors.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active corridors</p>
          ) : (
            <div className="space-y-3">
              {topCorridors.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">{c.name}</span>
                  </div>
                  <span className={cn("text-xs font-bold shrink-0", c.avgRisk > 30 ? "text-amber-400" : "text-emerald-400")}>
                    Avg Risk: {c.avgRisk}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Delayed Shipments */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Most Delayed Shipments</h3>
          </div>
          {delayedShipments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No delayed shipments</p>
          ) : (
            <div className="space-y-3">
              {delayedShipments.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Truck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-foreground font-mono">{s.shipmentCode}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{s.origin}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weather/Traffic Summary */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Weather & Traffic Summary</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-foreground">Traffic Congestion</span>
              </div>
              <span className="text-xs font-bold text-foreground">
                {kpisLoading ? "..." : (kpis?.avgDelayProbability ?? 0) > 30 ? "Elevated" : "Normal"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <Cloud className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-medium text-foreground">Weather Disruptions</span>
              </div>
              <span className="text-xs font-bold text-foreground">
                {kpisLoading ? "..." : (kpis?.avgDisruptionProbability ?? 0) > 30 ? "High Risk" : "Clear"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main split */}
      <div className="flex flex-col xl:flex-row gap-8">

        {/* Threat feed */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">Live Threat Feed</h2>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{threatFeed.length} active</span>
          </div>

          {threatLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted/10 rounded-xl animate-pulse border border-border" />)}</div>
          ) : threatFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 border border-border rounded-xl bg-emerald-400/5">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">No Active Threats</p>
                <p className="text-xs text-muted-foreground">All corridors are nominal.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {threatFeed.map((t, i) => {
                const c = severityColors(t.severity);
                return (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={cn("rounded-xl border p-5 space-y-3", c.bg, c.border)}>
                    <div className="flex items-start gap-3">
                      <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", c.dot)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{t.title}</p>
                          <span className={cn("text-[10px] uppercase tracking-widest font-bold", c.text)}>{t.severity}</span>
                          <span className="text-[10px] text-muted-foreground/60 ml-auto capitalize">{t.sub}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(t.time)}</p>
                    </div>
                    {t.action && <p className="text-xs text-muted-foreground pl-5 border-l-2 border-current/20">{t.action}</p>}
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="pt-4">
            <ManualIncidentForm onSuccess={() => { refreshThreats(); refreshKPIs(); }} />
          </div>
        </div>

        {/* At-risk shipments */}
        <div className="xl:w-80 shrink-0 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">At-Risk Shipments</h2>
          {atRiskShipments.length === 0 && activeShipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-border rounded-xl gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <p className="text-sm text-muted-foreground text-center">No shipments require attention</p>
            </div>
          ) : (
            <div className="space-y-3">
              {atRiskShipments.map((s) => (
                <Link key={s.id} href={`/shipments/${s.id}`}>
                  <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-5 hover:border-amber-400/40 transition-colors space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{s.shipmentCode}</span>
                      <span className="text-lg font-bold text-amber-400">{s.riskScore}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span className="truncate">{s.origin}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      <span className="truncate">{s.destination}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.eta} - {s.cargoType}</p>
                  </div>
                </Link>
              ))}
              {activeShipments.filter(s => s.status !== "at-risk").slice(0, 3).map((s) => (
                <Link key={s.id} href={`/shipments/${s.id}`}>
                  <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{s.shipmentCode}</span>
                      <span className={cn("text-lg font-bold", getRiskColor(s.riskLevel))}>{s.riskScore}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span className="truncate">{s.origin}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      <span className="truncate">{s.destination}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(s.lastUpdate)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Intelligence Sources */}
      <IntelligenceSources kpis={kpis} />
    </div>
  );
}
