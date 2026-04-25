"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  ArrowRight, Shield, Truck, Package, AlertTriangle, Zap,
  TrendingUp, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn, getRiskColor } from "@/lib/utils";
import type { Route, Shipment } from "@/lib/types";
import {
  deriveConfidence,
  confidenceLabel,
  confidenceReasons,
  recommendationBadge,
  decisionVerdict,
  selectionFeedback,
  liveInsightHint,
} from "@/lib/route-utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShipmentPassProps {
  route: Route;
  shipment: Partial<Shipment> & {
    origin: string;
    destination: string;
    cargoType: string;
    vehicleType: string;
    shipmentCode: string;
    confidencePercent?: number;
  };
  onConfirm?: () => void;
  morphLayoutId?: string;
  urgency?: string;
  /** All routes — used for spread-aware confidence and selection feedback */
  allRoutes?: Route[];
  dataSource?: string;
}

export type TearPhase = "idle" | "tearing" | "torn";

// ─── Shipment code visual ─────────────────────────────────────────────────────

function ShipmentCode({ code }: { code: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid grid-cols-8 gap-0.5 p-2 bg-foreground/5 rounded border border-border/50">
        {Array.from({ length: 64 }).map((_, i) => {
          const seed = (i * 7 + code.charCodeAt(i % code.length)) % 3;
          return (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-[1px]",
                seed === 0 ? "bg-foreground/80" : seed === 1 ? "bg-foreground/20" : "bg-transparent",
              )}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground tracking-widest">{code}</span>
    </div>
  );
}

// ─── Dispatched stub ──────────────────────────────────────────────────────────

export function DispatchedStub({
  shipment,
  route,
}: {
  shipment: ShipmentPassProps["shipment"];
  route: Route;
}) {
  const riskColor = getRiskColor(route.riskLevel);
  return (
    <div className="border border-dashed border-border/60 bg-card/60 overflow-hidden rounded-xl">
      <div className="h-px w-full bg-linear-to-r from-transparent via-border to-transparent" />
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <span>{shipment.origin}</span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{shipment.destination}</span>
        </div>
        <Badge className="text-[10px] bg-emerald-400/10 text-emerald-400 border-emerald-400/25 shrink-0">
          Dispatched
        </Badge>
      </div>
      <div className="px-6 pb-4 grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="label-meta">Shipment ID</p>
          <p className="text-xs font-mono font-semibold text-foreground">{shipment.shipmentCode}</p>
        </div>
        <div className="space-y-1">
          <p className="label-meta">Risk</p>
          <p className={cn("text-sm font-bold", riskColor)}>{route.riskScore}</p>
        </div>
        <div className="space-y-1">
          <p className="label-meta">ETA</p>
          <p className="text-sm font-semibold text-foreground">{route.eta}</p>
        </div>
      </div>
      <div className="px-6 pb-5">
        <ShipmentCode code={shipment.shipmentCode} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShipmentPass({ route, shipment, onConfirm, morphLayoutId, urgency, allRoutes = [], dataSource }: ShipmentPassProps) {
  const [tearPhase, setTearPhase] = useState<TearPhase>("idle");
  const riskColor  = getRiskColor(route.riskLevel);

  const confidence  = deriveConfidence(route, allRoutes, dataSource);
  const confLabel   = confidenceLabel(confidence);
  const confReasons = confidenceReasons(route, allRoutes, dataSource);
  const recContext  = route.recommended
    ? recommendationBadge(route, shipment.cargoType ?? "", urgency ?? "Standard", allRoutes)
    : null;
  const feedback    = selectionFeedback(route, shipment.cargoType, urgency, allRoutes);
  const insight     = liveInsightHint(route, allRoutes, dataSource);
  const verdict     = decisionVerdict(route, shipment.cargoType, urgency, allRoutes);

  const handleConfirm = () => {
    setTearPhase("tearing");
    toast.success("Shipment dispatched", {
      description: `${shipment.origin} → ${shipment.destination} • ${shipment.shipmentCode}`,
    });
    setTimeout(() => {
      setTearPhase("torn");
      setTimeout(() => onConfirm?.(), 200);
    }, 900);
  };

  return (
    <motion.div
      layoutId={morphLayoutId}
      layout
      transition={{ layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
      className="border border-border bg-card overflow-hidden rounded-xl"
    >
      <AnimatePresence>
        {tearPhase === "tearing" && (
          <>
            <motion.div
              key="tear-top"
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: "-52%", opacity: 0 }}
              exit={{}}
              transition={{ duration: 0.55, ease: [0.4, 0, 0.6, 1] }}
              className="absolute inset-x-0 top-0 bg-card z-30 pointer-events-none"
              style={{ height: "52%" }}
            />
            <motion.div
              key="tear-line"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: [0, 1, 0], scaleX: [0, 1, 1] }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-x-0 z-40 h-px bg-primary/60 pointer-events-none"
              style={{ top: "50%" }}
            />
            <motion.div
              key="tear-bottom"
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: "4px", opacity: 1 }}
              transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-x-0 bottom-0 bg-card z-30 pointer-events-none"
              style={{ height: "50%" }}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Risk alert banner ─────────────────────────────────────────────── */}
      {route.riskLevel !== "low" && (
        <div className="bg-amber-400/10 border-b border-amber-400/20 px-6 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-400 font-medium">
            Risk score {route.riskScore}/100 — {route.alerts[0] ?? "Monitor route conditions"}
          </span>
        </div>
      )}

      {/* ── Decision verdict ─────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-border/60 bg-muted/10">
        <p className="text-xs text-foreground/70 leading-relaxed font-medium">{verdict}</p>
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-start justify-between mb-1">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Logistics Authorization</p>
            <div className="flex items-center gap-2.5 text-xl font-bold text-foreground">
              <span>{shipment.origin}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span>{shipment.destination}</span>
            </div>
          </div>
          <div className="text-right mt-1 space-y-1">
            {recContext && (
              <p className="text-[10px] text-primary uppercase tracking-widest flex items-center gap-1 justify-end">
                <ShieldCheck className="w-3 h-3" /> {recContext}
              </p>
            )}
            <p className="text-sm font-semibold text-foreground">{route.name}</p>
          </div>
        </div>
      </div>

      {/* ── Key metrics ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-border border-b border-border">
        <div className="bg-card px-6 py-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">ETA</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">{route.eta}</p>
        </div>
        <div className="bg-card px-6 py-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Risk</p>
          <p className={cn("text-3xl font-bold tabular-nums", riskColor)}>
            {route.riskScore}
            <span className="text-xs font-normal text-muted-foreground ml-1 capitalize">/ {route.riskLevel}</span>
          </p>
        </div>
        <div className="bg-card px-6 py-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Distance</p>
          <p className="text-sm font-bold text-foreground">{route.distance}</p>
        </div>
        <div className="bg-card px-6 py-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Dispatch</p>
          <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Ready
          </p>
        </div>
      </div>

      {/* ── Risk factors ─────────────────────────────────────────────────── */}
      <div className="px-6 py-5 space-y-3 border-b border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Risk factors</p>
        {Object.entries(route.riskBreakdown).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-28 capitalize shrink-0">
              {key === "cargoSensitivity" ? "Cargo Sensitivity" : key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
            <Progress value={val} className="h-1.5 flex-1" />
            <span className="text-xs font-mono text-muted-foreground w-6 text-right">{val}</span>
          </div>
        ))}
      </div>

      <Separator className="opacity-20" />

      {/* ── Metadata grid ────────────────────────────────────────────────── */}
      <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-border">
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Shipment ID</p>
          <p className="text-xs font-mono font-semibold text-foreground">{shipment.shipmentCode}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Confidence</p>
          <p className={cn("text-xs font-semibold", confLabel.color)}>
            {confidence}% — {confLabel.label}
          </p>
          {confReasons.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {confReasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                  <TrendingUp className="w-2.5 h-2.5 shrink-0 mt-0.5 text-muted-foreground/50" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Package className="w-3 h-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Cargo</p>
          </div>
          <p className="text-xs font-semibold text-foreground">{shipment.cargoType}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Truck className="w-3 h-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Vehicle</p>
          </div>
          <p className="text-xs font-semibold text-foreground">{shipment.vehicleType}</p>
        </div>
      </div>

      {/* ── Selection feedback + live insight ────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border bg-muted/5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Selection rationale</p>
        <p className="text-xs text-foreground/80 leading-relaxed">{feedback}</p>
        {insight && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
            <p className="text-[10px] text-primary/60 uppercase tracking-widest">Live insight</p>
            <p className="text-[11px] text-primary/80 leading-relaxed">{insight}</p>
          </div>
        )}
      </div>

      {/* ── Shipment code ─────────────────────────────────────────────────── */}
      <div className="border-t border-dashed border-border/50 pt-5 pb-5 px-6">
        <ShipmentCode code={shipment.shipmentCode} />
      </div>

      {/* ── Confirm button ────────────────────────────────────────────────── */}
      <div className="px-6 pb-6">
        <Button
          className="w-full h-11 font-semibold text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
          onClick={handleConfirm}
          disabled={tearPhase !== "idle"}
        >
          {tearPhase === "tearing" ? (
            <span className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
              />
              Dispatching...
            </span>
          ) : (
            <>
              <Shield className="w-4 h-4 mr-2" />
              Confirm &amp; Dispatch Shipment
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
