"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MapPin, Calendar, Activity, Info, Plus, X, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Incident {
  incidentId:        string;
  title:             string;
  description:       string;
  category:          string;
  severity:          "low" | "medium" | "high" | "critical";
  latitude:          number;
  longitude:         number;
  affectedRadiusKm:  number;
  startTime:         string;
  impactScore:       number;
  confidence:        number;
  source:            string;
  recommendedAction: string;
}

const SEVERITY_OPTIONS = ["low", "medium", "high", "critical"] as const;
const CATEGORY_OPTIONS = [
  "Weather", "Traffic", "Road Closure", "Accident",
  "Construction", "Political", "Public Event", "Natural Disaster",
  "Restriction", "Unknown",
] as const;

const severityColor = (s: string) =>
  s === "critical" ? "bg-red-500/20 text-red-600" :
  s === "high"     ? "bg-orange-500/20 text-orange-600" :
  s === "medium"   ? "bg-amber-500/20 text-amber-600" :
                     "bg-blue-500/20 text-blue-600";

const iconBg = (s: string) =>
  s === "critical" ? "bg-red-500/10 text-red-500" :
  s === "high"     ? "bg-orange-500/10 text-orange-500" :
  s === "medium"   ? "bg-amber-500/10 text-amber-500" :
                     "bg-blue-500/10 text-blue-500";

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateIncidentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (incident: Incident) => void;
}) {
  const [form, setForm] = useState({
    title:             "",
    description:       "",
    category:          "Traffic" as string,
    severity:          "medium" as string,
    latitude:          "20.5937",
    longitude:         "78.9629",
    affectedRadiusKm:  "50",
    recommendedAction: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/intelligence/incidents", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:             form.title,
          description:       form.description,
          category:          form.category,
          severity:          form.severity,
          latitude:          parseFloat(form.latitude),
          longitude:         parseFloat(form.longitude),
          affectedRadiusKm:  parseInt(form.affectedRadiusKm, 10) || 50,
          recommendedAction: form.recommendedAction || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      onCreated(data.incident as Incident);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create incident");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Report New Incident</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Road closure on NH-48 near Chennai"
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Brief description of the incident..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Severity <span className="text-red-400">*</span>
              </label>
              <select
                value={form.severity}
                onChange={(e) => set("severity", e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Latitude <span className="text-red-400">*</span>
              </label>
              <input
                required
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => set("latitude", e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Longitude <span className="text-red-400">*</span>
              </label>
              <input
                required
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => set("longitude", e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Radius (km)</label>
              <input
                type="number"
                min="1"
                value={form.affectedRadiusKm}
                onChange={(e) => set("affectedRadiusKm", e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recommended Action</label>
            <input
              value={form.recommendedAction}
              onChange={(e) => set("recommendedAction", e.target.value)}
              placeholder="e.g. Avoid NH-48, use alternate route via NH-44"
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? "Reporting…" : "Report Incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [incidents, setIncidents]         = useState<Incident[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [showCreate, setShowCreate]       = useState(false);

  const fetchIncidents = async () => {
    try {
      const res = await fetch("/api/intelligence/incidents");
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, []);

  const handleCreated = (incident: Incident) => {
    setIncidents((prev) => [incident, ...prev]);
  };

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch =
      incident.title?.toLowerCase().includes(search.toLowerCase()) ||
      incident.description?.toLowerCase().includes(search.toLowerCase()) ||
      incident.category?.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {showCreate && (
        <CreateIncidentDialog
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Incident Center</h1>
          <p className="text-muted-foreground">
            Active disruptions and logistics incidents affecting corridors.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Report Incident
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search incidents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Severities</option>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">Loading incidents…</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No incidents match your filters.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm text-primary hover:underline font-medium"
            >
              Report the first incident
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredIncidents.map((incident) => (
              <div
                key={incident.incidentId}
                className="p-5 flex flex-col md:flex-row gap-4 md:items-center hover:bg-muted/10 transition-colors"
              >
                <div className="shrink-0">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", iconBg(incident.severity))}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{incident.title}</h3>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider", severityColor(incident.severity))}>
                      {incident.severity}
                    </span>
                    {incident.source?.startsWith("Manual:") && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider bg-primary/10 text-primary">
                        Manual
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl">{incident.description}</p>

                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                      {" "}(±{incident.affectedRadiusKm} km)
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5" />
                      {incident.category}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(incident.startTime).toLocaleString([], {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {incident.recommendedAction && (
                    <p className="text-xs text-amber-500 mt-1">⚡ {incident.recommendedAction}</p>
                  )}
                </div>

                <div className="shrink-0 text-right space-y-1 bg-muted/30 p-3 rounded-lg md:w-44">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Impact Score</p>
                  <p className="text-2xl font-bold">{incident.impactScore}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground mt-1">
                    <Info className="w-3 h-3" />
                    {incident.confidence}% confidence
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
