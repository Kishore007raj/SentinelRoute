"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Zap, CheckCircle, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useUser } from "@/lib/auth-context";

const LOCATION_OPTIONS = [
  "Chennai", "Bangalore", "Hyderabad", "Pune",
  "Mumbai", "Coimbatore", "Salem", "Thrissur", "Vijayawada",
];
const VEHICLE_OPTIONS = ["Mini Truck", "Container Truck", "Reefer Truck", "Express Van"];
const CARGO_OPTIONS = ["Electronics", "Pharmaceuticals", "Cold Chain Goods", "Industrial Parts"];
const URGENCY_OPTIONS = ["Standard", "Priority", "Critical"];
const INSURANCE_OPTIONS = ["None", "Standard", "Full Coverage"];
const TEMP_OPTIONS = ["None", "Low (0–10°C)", "Frozen (−18°C)"];

type FormState = Record<string, string>;

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

// ─── Location input ───────────────────────────────────────────────────────────
function LocationInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const filtered = LOCATION_OPTIONS.filter(
    (o) => o.toLowerCase().includes(query.toLowerCase())
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setQuery(newVal);
    setOpen(true);
    // Clear the confirmed value if the user edits away from it
    if (newVal !== value) {
      onChange("");
    }
  };

  return (
    <div className="relative max-w-sm">
      <div className="flex items-center gap-3">
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? "Enter city or hub..."}
          className="h-11 bg-muted/20 border-border text-sm font-medium rounded-lg"
        />
        {value && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border shadow-xl mt-1 rounded-lg overflow-hidden">
          {filtered.slice(0, 6).map((opt) => (
            <button
              key={opt}
              onMouseDown={() => { onChange(opt); setQuery(opt); setOpen(false); }}
              className={cn(
                "w-full text-left px-4 py-3 text-sm hover:bg-muted/40 transition-colors",
                value === opt ? "text-primary bg-primary/5" : "text-foreground",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CreateShipmentPage() {
  const router = useRouter();
  const { setPendingShipment } = useStore();
  const { user } = useUser();
  const [form, setForm] = useState<FormState>({});
  const [loading, setLoading] = useState(false);

  const set = (id: string, val: string) => setForm((p) => ({ ...p, [id]: val }));

  const requiredFields = ["origin", "destination", "vehicleType", "cargoType", "urgency"];
  const filledRequired = requiredFields.filter((k) => !!form[k]).length;
  const requiredFilled = filledRequired === requiredFields.length;

  const [routePreview, setRoutePreview] = useState<{
    eta: string;
    riskRange: string;
    distance: string;
    routesFound: number;
  } | null>(null);

  useEffect(() => {
    if (form.origin && form.destination && form.origin !== form.destination) {
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
              origin:      form.origin,
              destination: form.destination,
              cargoType:   form.cargoType || "General Freight",
              vehicleType: form.vehicleType || "Container Truck",
              urgency:     form.urgency || "Standard",
            }),
            signal: controller.signal,
          });
          if (!res.ok) { setRoutePreview(null); return; }
          const data = await res.json();
          const routes: { eta: string; distance: string; riskScore: number; label: string }[] = data.routes ?? [];
          if (routes.length === 0) { setRoutePreview(null); return; }

          // Use balanced route for preview; fall back to first route
          const balanced = routes.find((r) => r.label === "balanced") ?? routes[0];
          const minRisk = Math.min(...routes.map((r) => r.riskScore));
          const maxRisk = Math.max(...routes.map((r) => r.riskScore));

          setRoutePreview({
            eta:           balanced.eta,
            distance:      balanced.distance,
            riskRange:     `${minRisk} – ${maxRisk}`,
            routesFound:   routes.length,
          });
        } catch (err) {
          if ((err as { name?: string }).name !== "AbortError") {
            setRoutePreview(null);
          }
        }
      }, 600);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }
    
    // Clear preview when conditions aren't met - do this in a separate effect or timeout
    const clearTimer = setTimeout(() => {
      if (!form.origin || !form.destination || form.origin === form.destination) {
        setRoutePreview(null);
      }
    }, 0);

    return () => clearTimeout(clearTimer);
  }, [form.origin, form.destination, form.cargoType, form.vehicleType, form.urgency, user]);

  const handleAnalyze = () => {
    setLoading(true);
    setPendingShipment({
      origin: form.origin ?? "",
      destination: form.destination ?? "",
      vehicleType: form.vehicleType ?? "",
      cargoType: form.cargoType ?? "",
      urgency: form.urgency ?? "",
      deadline: form.deadline,
      insurance: form.insurance,
      tempSensitive: form.tempSensitive,
    });
    setTimeout(() => router.push("/routes"), 1400);
  };

  const cargoRiskNote =
    form.cargoType === "Pharmaceuticals" ? "Cold-chain sensitivity active — route scoring adjusted"
    : form.cargoType === "Cold Chain Goods" ? "Temperature monitoring required along selected corridor"
    : form.cargoType === "Electronics" ? "Heat exposure risk flagged — avoid high-disruption routes"
    : null;

  return (
    <div className="max-w-7xl mx-auto w-full">

      {/* Page header */}
      <div className="mb-10 pb-8 border-b border-border space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Mission configuration</p>
        <h1 className="text-3xl font-bold text-foreground">New Shipment</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Configure shipment parameters. All required fields must be completed before route analysis.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 xl:gap-16">

        {/* ── Form ── */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* Route section */}
          <div>
            <SectionLabel>Route</SectionLabel>
            <FieldRow label="Origin" required>
              <LocationInput
                value={form.origin ?? ""}
                onChange={(v) => set("origin", v)}
                placeholder="e.g. Chennai"
              />
            </FieldRow>
            <FieldRow label="Destination" required>
              <LocationInput
                value={form.destination ?? ""}
                onChange={(v) => set("destination", v)}
                placeholder="e.g. Bangalore"
              />
            </FieldRow>
          </div>

          {/* Vehicle & Cargo section */}
          <div>
            <SectionLabel>Vehicle & Cargo</SectionLabel>
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
                  animate={{ width: `${(filledRequired / requiredFields.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{filledRequired}/{requiredFields.length} required</span>
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
              {form.origin || form.destination ? (
                <div className="flex items-center gap-2 text-lg font-bold text-foreground flex-wrap">
                  <span className={form.origin ? "text-foreground" : "text-muted-foreground/30"}>
                    {form.origin || "Origin"}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <span className={form.destination ? "text-foreground" : "text-muted-foreground/30"}>
                    {form.destination || "Destination"}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/40">Set origin and destination to preview</p>
              )}
            </div>

            {routePreview && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Expected profile</p>
                <div className="space-y-0">
                  {[
                    { label: "Fastest ETA",      value: routePreview.eta,        color: "text-foreground" },
                    { label: "Distance",          value: routePreview.distance,   color: "text-foreground" },
                    { label: "Risk range",        value: routePreview.riskRange,  color: "text-amber-400" },
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
                  { label: "Origin", key: "origin" },
                  { label: "Destination", key: "destination" },
                  { label: "Vehicle", key: "vehicleType" },
                  { label: "Cargo", key: "cargoType" },
                  { label: "Urgency", key: "urgency" },
                ].map(({ label, key }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    {form[key] ? (
                      <span className="text-sm text-foreground font-medium truncate max-w-[140px]">{form[key]}</span>
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
