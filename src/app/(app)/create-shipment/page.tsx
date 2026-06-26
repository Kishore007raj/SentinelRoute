"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Zap, CheckCircle, ChevronRight, ArrowRight, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useUser } from "@/lib/auth-context";
import type { PendingShipment } from "@/lib/types";

const VEHICLE_OPTIONS = ["Mini Truck", "Container Truck", "Reefer Truck", "Express Van"];
const CARGO_OPTIONS = ["Electronics", "Pharmaceuticals", "Cold Chain Goods", "Industrial Parts"];
const URGENCY_OPTIONS = ["Standard", "Priority", "Critical"];
const INSURANCE_OPTIONS = ["None", "Standard", "Full Coverage"];
const TEMP_OPTIONS = ["None", "Low (0–10°C)", "Frozen (−18°C)"];

// ─── Mappls suggestion type ───────────────────────────────────────────────────
interface MapplsSuggestion {
  placeId:      string;
  placeName:    string;
  placeAddress: string;
  lat:          number | null;
  lng:          number | null;
}

// ─── Confirmed location value ─────────────────────────────────────────────────
interface ConfirmedLocation {
  name:      string;  // display name (city / hub)
  address:   string;  // full address string
  lat:       number;
  lng:       number;
  placeId:   string;
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-6 pb-3 border-b border-border/40">
      {children}
    </p>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────
function FieldRow({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-8 py-6 border-b border-border/30 last:border-0">
      <div className="sm:w-40 shrink-0 pt-1">
        <p className="text-sm font-medium text-muted-foreground">
          {label}{required && <span className="text-amber-400 ml-1">*</span>}
        </p>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Select options ───────────────────────────────────────────────────────────
function SelectOptions({ options, value, onChange }: {
  options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border rounded-lg transition-all duration-100",
            value === opt
              ? "bg-primary/10 border-primary/50 text-primary"
              : "bg-transparent border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {value === opt && <CheckCircle className="w-3.5 h-3.5 inline mr-1.5" />}
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Mappls location input ────────────────────────────────────────────────────
function MapplsLocationInput({
  value,
  onConfirm,
  placeholder,
}: {
  value: ConfirmedLocation | null;
  onConfirm: (loc: ConfirmedLocation) => void;
  placeholder?: string;
}) {
  const [query, setQuery]           = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<MapplsSuggestion[]>([]);
  const [open, setOpen]             = useState(false);
  const [fetching, setFetching]     = useState(false);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef                    = useRef<AbortController | null>(null);

  // Keep input text in sync if the confirmed value is cleared externally
  // Use a layout effect with startTransition to avoid synchronous setState-in-effect warning
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

    // Cancel prior in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFetching(true);
    fetch(`/api/mappls/autosuggest?q=${encodeURIComponent(q.trim())}`, {
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

  const handleSelect = (s: MapplsSuggestion) => {
    if (s.lat == null || s.lng == null) return;
    const loc: ConfirmedLocation = {
      name:    s.placeName,
      address: s.placeAddress,
      lat:     s.lat,
      lng:     s.lng,
      placeId: s.placeId,
    };
    onConfirm(loc);
    setQuery(s.placeName);
    setSuggestions([]);
    setOpen(false);
  };

  const confirmed = value !== null;

  return (
    <div className="relative max-w-sm">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <Input
            value={query}
            onChange={handleChange}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder ?? "Search any location in India..."}
            className="h-11 bg-muted/20 border-border text-sm font-medium rounded-lg pl-9"
          />
          {fetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>
        {confirmed && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border shadow-xl mt-1 rounded-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0"
            >
              <p className="font-medium text-foreground truncate">{s.placeName}</p>
              {s.placeAddress && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{s.placeAddress}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Coordinate confirmation badge */}
      {confirmed && value && (
        <p className="text-[10px] text-emerald-400/70 mt-1 pl-1">
          {value.lat.toFixed(4)}, {value.lng.toFixed(4)} · {value.placeId}
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CreateShipmentPage() {
  const router = useRouter();
  const { setPendingShipment } = useStore();
  const { user } = useUser();
  const [form, setForm] = useState<Record<string, string>>({});
  const [origin, setOrigin]           = useState<ConfirmedLocation | null>(null);
  const [destination, setDestination] = useState<ConfirmedLocation | null>(null);
  const [loading, setLoading]         = useState(false);

  const set = (id: string, val: string) => setForm((p) => ({ ...p, [id]: val }));

  // Required: both location objects confirmed + vehicleType + cargoType + urgency
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

  const [routePreview, setRoutePreview] = useState<{
    eta: string;
    riskRange: string;
    distance: string;
    routesFound: number;
  } | null>(null);

  // Live preview — fires when both confirmed locations change
  useEffect(() => {
    if (!origin || !destination || origin.placeId === destination.placeId) {
      const t = setTimeout(() => setRoutePreview(null), 0);
      return () => clearTimeout(t);
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch("/api/analyze-routes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            origin:         origin.name,
            destination:    destination.name,
            originLat:      origin.lat,
            originLng:      origin.lng,
            destinationLat: destination.lat,
            destinationLng: destination.lng,
            cargoType:      form.cargoType  || "General Freight",
            vehicleType:    form.vehicleType || "Container Truck",
            urgency:        form.urgency    || "Standard",
          }),
          signal: controller.signal,
        });
        if (!res.ok) { setRoutePreview(null); return; }
        const data = await res.json();
        const routes: { eta: string; distance: string; riskScore: number; label: string }[] = data.routes ?? [];
        if (routes.length === 0) { setRoutePreview(null); return; }
        const balanced = routes.find((r) => r.label === "balanced") ?? routes[0];
        const minRisk  = Math.min(...routes.map((r) => r.riskScore));
        const maxRisk  = Math.max(...routes.map((r) => r.riskScore));
        setRoutePreview({
          eta:         balanced.eta,
          distance:    balanced.distance,
          riskRange:   `${minRisk} – ${maxRisk}`,
          routesFound: routes.length,
        });
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") setRoutePreview(null);
      }
    }, 800);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [origin, destination, form.cargoType, form.vehicleType, form.urgency, user]);

  const handleAnalyze = () => {
    if (!origin || !destination) return;
    setLoading(true);

    const pending: PendingShipment = {
      origin:             origin.name,
      destination:        destination.name,
      vehicleType:        form.vehicleType ?? "",
      cargoType:          form.cargoType ?? "",
      urgency:            form.urgency ?? "",
      deadline:           form.deadline,
      insurance:          form.insurance,
      tempSensitive:      form.tempSensitive,
      // Mappls coordinate data
      originName:         origin.name,
      originAddress:      origin.address,
      originLat:          origin.lat,
      originLng:          origin.lng,
      originPlaceId:      origin.placeId,
      destinationName:    destination.name,
      destinationAddress: destination.address,
      destinationLat:     destination.lat,
      destinationLng:     destination.lng,
      destinationPlaceId: destination.placeId,
    };

    setPendingShipment(pending);
    setTimeout(() => router.push("/routes"), 1400);
  };

  const cargoRiskNote =
    form.cargoType === "Pharmaceuticals"  ? "Cold-chain sensitivity active — route scoring adjusted"
    : form.cargoType === "Cold Chain Goods" ? "Temperature monitoring required along selected corridor"
    : form.cargoType === "Electronics"     ? "Heat exposure risk flagged — avoid high-disruption routes"
    : null;

  return (
    <div className="max-w-7xl mx-auto w-full">

      {/* Page header */}
      <div className="mb-10 pb-8 border-b border-border space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Mission configuration</p>
        <h1 className="text-3xl font-bold text-foreground">New Shipment</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Search any location across India — Mappls autosuggest provides live suggestions with coordinates.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">

        {/* ── Form ── */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* Route section */}
          <div>
            <SectionLabel>Route</SectionLabel>
            <FieldRow label="Origin" required>
              <MapplsLocationInput
                value={origin}
                onConfirm={setOrigin}
                placeholder="Search any city, hub, or address in India..."
              />
            </FieldRow>
            <FieldRow label="Destination" required>
              <MapplsLocationInput
                value={destination}
                onConfirm={setDestination}
                placeholder="Search any city, hub, or address in India..."
              />
            </FieldRow>
          </div>

          {/* Vehicle & Cargo section */}
          <div>
            <SectionLabel>Vehicle &amp; Cargo</SectionLabel>
            <FieldRow label="Vehicle type" required>
              <SelectOptions
                options={VEHICLE_OPTIONS}
                value={form.vehicleType ?? ""}
                onChange={(v) => set("vehicleType", v)}
              />
            </FieldRow>
            <FieldRow label="Cargo type" required>
              <div className="space-y-4">
                <SelectOptions
                  options={CARGO_OPTIONS}
                  value={form.cargoType ?? ""}
                  onChange={(v) => set("cargoType", v)}
                />
                {cargoRiskNote && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 border border-amber-400/20 bg-amber-400/5 px-5 py-4 rounded-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-400/90 leading-relaxed">{cargoRiskNote}</p>
                  </motion.div>
                )}
              </div>
            </FieldRow>
          </div>

          {/* Operational section */}
          <div>
            <SectionLabel>Operational</SectionLabel>
            <FieldRow label="Urgency" required>
              <div className="space-y-4">
                <SelectOptions
                  options={URGENCY_OPTIONS}
                  value={form.urgency ?? ""}
                  onChange={(v) => set("urgency", v)}
                />
                {form.urgency === "Critical" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 border border-red-400/20 bg-red-400/5 px-5 py-4 rounded-lg"
                  >
                    <Zap className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400/90 leading-relaxed">
                      Critical urgency — fastest route will be weighted higher in analysis.
                    </p>
                  </motion.div>
                )}
              </div>
            </FieldRow>
            <FieldRow label="Deadline">
              <Input
                type="datetime-local"
                value={form.deadline ?? ""}
                onChange={(e) => set("deadline", e.target.value)}
                className="h-11 bg-muted/20 border-border text-sm max-w-xs rounded-lg scheme-dark"
              />
            </FieldRow>
          </div>

          {/* Optional section */}
          <div>
            <SectionLabel>Optional</SectionLabel>
            <FieldRow label="Insurance">
              <SelectOptions
                options={INSURANCE_OPTIONS}
                value={form.insurance ?? ""}
                onChange={(v) => set("insurance", v)}
              />
            </FieldRow>
            <FieldRow label="Temp sensitivity">
              <SelectOptions
                options={TEMP_OPTIONS}
                value={form.tempSensitive ?? ""}
                onChange={(v) => set("tempSensitive", v)}
              />
            </FieldRow>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pt-6 border-t border-border">
            <div className="flex items-center gap-4">
              <div className="h-2 w-44 bg-muted overflow-hidden rounded-full">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${(filledCount / 5) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{filledCount}/5 required</span>
            </div>
            <Button
              className="sm:ml-auto gap-2 px-8 h-11 font-semibold rounded-lg"
              disabled={!requiredFilled || loading}
              onClick={handleAnalyze}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                    className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  />
                  Analyzing routes...
                </span>
              ) : (
                <>Analyze Routes <ChevronRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>

        {/* ── Preview panel ── */}
        <div className="hidden lg:block lg:w-72 xl:w-80 shrink-0">
          <div className="sticky top-8 space-y-8">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Route preview</p>
              {origin || destination ? (
                <div className="flex items-center gap-2 text-lg font-bold text-foreground flex-wrap">
                  <span className={origin ? "text-foreground" : "text-muted-foreground/30"}>
                    {origin?.name || "Origin"}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <span className={destination ? "text-foreground" : "text-muted-foreground/30"}>
                    {destination?.name || "Destination"}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/40">Search and select origin and destination</p>
              )}
            </div>

            {routePreview && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Expected profile</p>
                <div className="space-y-0">
                  {[
                    { label: "Fastest ETA",      value: routePreview.eta,         color: "text-foreground" },
                    { label: "Distance",          value: routePreview.distance,    color: "text-foreground" },
                    { label: "Risk range",        value: routePreview.riskRange,   color: "text-amber-400" },
                    { label: "Routes available",  value: String(routePreview.routesFound), color: "text-primary" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-3 border-b border-border/30">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={cn("text-sm font-bold", color)}>{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Configuration</p>
              <div className="space-y-0">
                {[
                  { label: "Origin",      value: origin?.name },
                  { label: "Destination", value: destination?.name },
                  { label: "Vehicle",     value: form.vehicleType },
                  { label: "Cargo",       value: form.cargoType },
                  { label: "Urgency",     value: form.urgency },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    {value ? (
                      <span className="text-sm text-foreground font-medium truncate max-w-[140px]">{value}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground/30">—</span>
                    )}
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
