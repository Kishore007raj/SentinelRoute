"use client";

import { fetchApi } from "@/lib/api-client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Zap, CheckCircle, ChevronRight, ArrowRight, MapPin, Loader2, Navigation, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { PendingShipment } from "@/lib/types";
import dynamic from "next/dynamic";

const CorridorMapPreview = dynamic(() => import("@/components/shipment/CorridorMapPreview"), { ssr: false });

const VEHICLE_OPTIONS = ["Mini Truck", "Container Truck", "Reefer Truck", "Express Van"];
const CARGO_OPTIONS = ["Electronics", "Pharmaceuticals", "Cold Chain Goods", "Industrial Parts"];
const URGENCY_OPTIONS = ["Standard", "Priority", "Critical"];
const INSURANCE_OPTIONS = ["None", "Standard", "Full Coverage"];
const TEMP_OPTIONS = ["None", "Low (0–10°C)", "Frozen (−18°C)"];

// ─── Geoapify suggestion type ───────────────────────────────────────────────────
interface GeoapifySuggestion {
  placeId: string;
  placeName: string;
  placeAddress: string;
  lat: number | null;
  lng: number | null;
}

// ─── Confirmed location value ─────────────────────────────────────────────────
interface ConfirmedLocation {
  name: string; // display name (city / hub)
  address: string; // full address string
  lat: number;
  lng: number;
  placeId: string;
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <Layers className="w-3.5 h-3.5 text-primary" />
      <h2 className="label-meta text-xs uppercase tracking-widest font-bold text-foreground">
        {children}
      </h2>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────
function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-8 py-5 border-b border-border/40 last:border-0">
      <div className="sm:w-40 shrink-0 pt-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
          {required && <span className="text-amber-400 ml-1">*</span>}
        </label>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Select options ───────────────────────────────────────────────────────────
function SelectOptions({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => {
        const isSelected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all duration-150 flex items-center gap-1.5",
              isSelected
                ? "bg-primary/10 border-primary text-primary shadow-xs"
                : "bg-card border-border/70 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/20"
            )}
          >
            {isSelected && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Geoapify location input ────────────────────────────────────────────────────
function GeoapifyLocationInput({
  value,
  onConfirm,
  placeholder,
}: {
  value: ConfirmedLocation | null;
  onConfirm: (loc: ConfirmedLocation) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<GeoapifySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!value) setQuery("");
    }, 0);
    return () => clearTimeout(t);
  }, [value]);

  const fetchSuggestions = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFetching(true);
    fetchApi(`/api/geoapify/autosuggest?q=${encodeURIComponent(q.trim())}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      })
      .catch((err) => {
        if ((err as { name?: string }).name !== "AbortError") {
          setSuggestions([]);
        }
      })
      .finally(() => setFetching(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  };

  const handleSelect = (s: GeoapifySuggestion) => {
    if (s.lat == null || s.lng == null) return;
    const loc: ConfirmedLocation = {
      name: s.placeName,
      address: s.placeAddress,
      lat: s.lat,
      lng: s.lng,
      placeId: s.placeId,
    };
    onConfirm(loc);
    setQuery(s.placeName);
    setSuggestions([]);
    setOpen(false);
  };

  const confirmed = value !== null;

  return (
    <div className="relative max-w-md">
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70 pointer-events-none" />
          <Input
            value={query}
            onChange={handleChange}
            onFocus={() => {
              if (suggestions.length > 0) setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder ?? "Search location in India..."}
            className="h-10 bg-muted/20 border-border text-xs font-medium rounded-lg pl-9 pr-8"
          />
          {fetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
          )}
        </div>
        {confirmed && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border shadow-xl mt-1.5 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0"
            >
              <p className="font-semibold text-foreground truncate">{s.placeName}</p>
              {s.placeAddress && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.placeAddress}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {confirmed && value && (
        <p className="text-[11px] text-emerald-400 mt-1 pl-1 truncate font-medium">
          ✓ {value.address || value.name}
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CreateShipmentPage() {
  const router = useRouter();
  const { setPendingShipment } = useStore();
  const [form, setForm] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState<ConfirmedLocation | null>(null);
  const [destination, setDestination] = useState<ConfirmedLocation | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (id: string, val: string) => setForm((p) => ({ ...p, [id]: val }));

  const requiredFilled =
    origin !== null &&
    destination !== null &&
    origin.placeId !== destination.placeId &&
    !!form.vehicleType &&
    !!form.cargoType &&
    !!form.urgency;

  const filledCount = [
    origin !== null,
    destination !== null,
    !!form.vehicleType,
    !!form.cargoType,
    !!form.urgency,
  ].filter(Boolean).length;

  // ── Client-side route preview (no API call) ────────────────────────────────
  // Removed the debounced /api/analyze-routes effect that was causing 3-4
  // unnecessary requests per shipment. Actual route analysis happens on /routes page.
  const routePreview = useMemo(() => {
    if (!origin || !destination || origin.placeId === destination.placeId) return null;

    // Haversine distance estimation
    const R = 6371; // Earth radius in km
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLng = (destination.lng - origin.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = Math.round(R * c);
    
    // Rough ETA estimate (50 km/h average for Indian highways)
    const etaMinutes = Math.round((distanceKm / 50) * 60);
    const etaHours = Math.floor(etaMinutes / 60);
    const etaMins = etaMinutes % 60;
    const etaStr = etaHours > 0 
      ? (etaMins > 0 ? `${etaHours}h ${etaMins}m` : `${etaHours}h`)
      : `${etaMins}m`;

    return {
      eta: `~${etaStr}`,
      distance: `~${distanceKm} km`,
      riskRange: "—",
      routesFound: 3,
      routes: [], // No routes until actual analysis
    };
  }, [origin, destination]);

  const handleAnalyze = () => {
    if (!origin || !destination) return;
    setLoading(true);

    const pending: PendingShipment = {
      origin: origin.name,
      destination: destination.name,
      vehicleType: form.vehicleType ?? "",
      cargoType: form.cargoType ?? "",
      urgency: form.urgency ?? "",
      deadline: form.deadline,
      insurance: form.insurance,
      tempSensitive: form.tempSensitive,
      originName: origin.name,
      originAddress: origin.address,
      originLat: origin.lat,
      originLng: origin.lng,
      originPlaceId: origin.placeId,
      destinationName: destination.name,
      destinationAddress: destination.address,
      destinationLat: destination.lat,
      destinationLng: destination.lng,
      destinationPlaceId: destination.placeId,
      createdAt: Date.now(), // Timestamp ensures fresh analysis on new shipment
    };

    setPendingShipment(pending);
    setTimeout(() => router.push("/routes"), 1400);
  };

  const cargoRiskNote =
    form.cargoType === "Pharmaceuticals"
      ? "Cold-chain sensitivity active - route scoring adjusted"
      : form.cargoType === "Cold Chain Goods"
      ? "Temperature monitoring required along selected corridor"
      : form.cargoType === "Electronics"
      ? "Heat exposure risk flagged - avoid high-disruption routes"
      : null;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-7 pb-12">
      {/* Page Header */}
      <div className="border-b border-border pb-6">
        <p className="label-meta flex items-center gap-2 mb-2">
          <Navigation className="w-3.5 h-3.5 text-primary" />
          Dispatch Operations & Corridor Setup
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">New Shipment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure origin, destination, cargo sensitivity, and vehicle parameters for route risk analysis.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* ── Main Form Column ── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Route Parameters */}
          <div className="panel p-5 bg-card">
            <SectionLabel>Route Coordinates</SectionLabel>
            <FieldRow label="Origin" required>
              <GeoapifyLocationInput
                value={origin}
                onConfirm={setOrigin}
                placeholder="Search city, hub, or address in India..."
              />
            </FieldRow>
            <FieldRow label="Destination" required>
              <GeoapifyLocationInput
                value={destination}
                onConfirm={setDestination}
                placeholder="Search city, hub, or address in India..."
              />
            </FieldRow>
          </div>

          {/* Vehicle & Cargo */}
          <div className="panel p-5 bg-card">
            <SectionLabel>Vehicle & Cargo Parameters</SectionLabel>
            <FieldRow label="Vehicle Type" required>
              <SelectOptions
                options={VEHICLE_OPTIONS}
                value={form.vehicleType ?? ""}
                onChange={(v) => set("vehicleType", v)}
              />
            </FieldRow>
            <FieldRow label="Cargo Type" required>
              <div className="space-y-3">
                <SelectOptions
                  options={CARGO_OPTIONS}
                  value={form.cargoType ?? ""}
                  onChange={(v) => set("cargoType", v)}
                />
                {cargoRiskNote && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5 border border-amber-400/20 bg-amber-400/5 px-3.5 py-3 rounded-lg text-xs text-amber-400"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{cargoRiskNote}</span>
                  </motion.div>
                )}
              </div>
            </FieldRow>
          </div>

          {/* Operational Parameters */}
          <div className="panel p-5 bg-card">
            <SectionLabel>Operational Scheduling</SectionLabel>
            <FieldRow label="Urgency" required>
              <div className="space-y-3">
                <SelectOptions
                  options={URGENCY_OPTIONS}
                  value={form.urgency ?? ""}
                  onChange={(v) => set("urgency", v)}
                />
                {form.urgency === "Critical" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5 border border-red-400/20 bg-red-400/5 px-3.5 py-3 rounded-lg text-xs text-red-400"
                  >
                    <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Critical urgency — fastest route will be weighted higher in risk analysis.</span>
                  </motion.div>
                )}
              </div>
            </FieldRow>
            <FieldRow label="Deadline">
              <Input
                type="datetime-local"
                value={form.deadline ?? ""}
                onChange={(e) => set("deadline", e.target.value)}
                className="h-10 bg-muted/20 border-border text-xs max-w-xs rounded-lg font-medium"
              />
            </FieldRow>
          </div>

          {/* Optional Specs */}
          <div className="panel p-5 bg-card">
            <SectionLabel>Insurance & Temperature Controls</SectionLabel>
            <FieldRow label="Insurance">
              <SelectOptions
                options={INSURANCE_OPTIONS}
                value={form.insurance ?? ""}
                onChange={(v) => set("insurance", v)}
              />
            </FieldRow>
            <FieldRow label="Temp Control">
              <SelectOptions
                options={TEMP_OPTIONS}
                value={form.tempSensitive ?? ""}
                onChange={(v) => set("tempSensitive", v)}
              />
            </FieldRow>
          </div>

          {/* Bottom Action Strip */}
          <div className="panel p-5 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-36 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${(filledCount / 5) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {filledCount}/5 required parameters
              </span>
            </div>

            <Button
              className="h-10 px-6 font-bold uppercase tracking-wider text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              disabled={!requiredFilled || loading}
              onClick={handleAnalyze}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Analyzing Routes…
                </>
              ) : (
                <>
                  Analyze Routes <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Preview Panel Column (Right) ── */}
        <div className="w-full lg:w-96 xl:w-105 shrink-0 space-y-4">
          <div className="sticky top-6 space-y-4">
            {/* Route Preview Section */}
            <div className="panel p-5 bg-card space-y-4">
              <p className="label-meta">Route Corridor Preview</p>

              {origin || destination ? (
                <>
                  {/* Origin → Destination */}
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground flex-wrap">
                    <span className={origin ? "text-foreground" : "text-muted-foreground/40"}>
                      {origin?.name || "Origin"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    <span className={destination ? "text-foreground" : "text-muted-foreground/40"}>
                      {destination?.name || "Destination"}
                    </span>
                  </div>

                  {/* Expected Profile */}
                  {routePreview && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Expected Profile</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-muted/10 border border-border/40 rounded">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Fastest ETA</p>
                          <p className="font-bold text-foreground">{routePreview.eta}</p>
                        </div>
                        <div className="p-2 bg-muted/10 border border-border/40 rounded">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Distance</p>
                          <p className="font-bold text-foreground">{routePreview.distance}</p>
                        </div>
                        <div className="p-2 bg-muted/10 border border-border/40 rounded">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Risk range</p>
                          <p className="font-bold text-amber-400">45–65</p>
                        </div>
                        <div className="p-2 bg-muted/10 border border-border/40 rounded">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Traffic severity</p>
                          <p className="font-bold text-red-400">18%</p>
                        </div>
                        <div className="p-2 bg-muted/10 border border-border/40 rounded">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Weather risk</p>
                          <p className="font-bold text-blue-400">42%</p>
                        </div>
                        <div className="p-2 bg-muted/10 border border-border/40 rounded">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Disruption prob.</p>
                          <p className="font-bold text-amber-400">40%</p>
                        </div>
                        <div className="col-span-2 p-2 bg-muted/10 border border-border/40 rounded">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Routes available</p>
                          <p className="font-bold text-primary">3</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground/60">
                  Select origin and destination to load corridor geometry.
                </p>
              )}
            </div>

            {/* Large Map */}
            {(origin || destination) && (
              <div className="panel p-0 overflow-hidden bg-card">
                <div className="w-full h-52 bg-muted/10 relative" style={{ minHeight: "208px" }}>
                  <CorridorMapPreview origin={origin} destination={destination} />
                </div>
              </div>
            )}

            {/* Metric Row */}
            {routePreview && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-3 gap-3"
              >
                <div className="panel p-3 bg-card text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">ETA</p>
                  <p className="text-sm font-bold text-foreground">{routePreview.eta}</p>
                </div>
                <div className="panel p-3 bg-card text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Weather</p>
                  <p className="text-sm font-bold text-blue-400">Clear</p>
                </div>
                <div className="panel p-3 bg-card text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Distance</p>
                  <p className="text-sm font-bold text-foreground">{routePreview.distance}</p>
                </div>
              </motion.div>
            )}

            {/* Risk Factors */}
            {routePreview && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="panel p-5 bg-card space-y-3"
              >
                <p className="label-meta">Risk Factors</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: "traffic", value: 47, color: "text-amber-400" },
                    { label: "weather", value: 40, color: "text-blue-400" },
                    { label: "disruption", value: 40, color: "text-amber-400" },
                    { label: "cargo", value: 80, color: "text-red-400" },
                    { label: "festival", value: 0, color: "text-emerald-400" },
                    { label: "news", value: 46, color: "text-amber-400" },
                    { label: "historical", value: 6, color: "text-emerald-400" },
                    { label: "road", value: 6, color: "text-emerald-400" },
                    { label: "operational", value: 2, color: "text-emerald-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-2 bg-muted/10 border border-border/40 rounded text-center">
                      <p className="text-[10px] text-muted-foreground capitalize mb-1">{label}</p>
                      <p className={cn("font-bold", color)}>{value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Cargo Alert */}
            {form.cargoType === "Cold Chain Goods" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="panel p-4 bg-amber-400/5 border border-amber-400/20"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-amber-400">Cold-chain sensitivity active - route scoring adjusted</p>
                    <p className="text-muted-foreground">Temperature monitoring required along selected corridor</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Why this route? */}
            {routePreview && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="panel p-4 bg-card space-y-2"
              >
                <p className="text-xs font-semibold text-foreground">Why this route?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Click <span className="font-semibold text-foreground">&ldquo;Analyze Routes&rdquo;</span> for detailed risk analysis and ETA calculation with real-time traffic, weather, and incident intelligence.
                </p>
              </motion.div>
            )}

            {/* Configuration Summary */}
            <div className="panel p-5 bg-card space-y-3">
              <p className="label-meta">Configuration</p>
              <div className="divide-y divide-border/40 text-xs">
                {[
                  { label: "Origin", value: origin?.name },
                  { label: "Destination", value: destination?.name },
                  { label: "Vehicle", value: form.vehicleType },
                  { label: "Cargo", value: form.cargoType },
                  { label: "Urgency", value: form.urgency },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground truncate max-w-40 text-right">
                      {value || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
