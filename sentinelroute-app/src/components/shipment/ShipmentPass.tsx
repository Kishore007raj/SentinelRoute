"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  ArrowRight,
  Shield,
  Clock,
  MapPin,
  Truck,
  Package,
  AlertTriangle,
  Star,
  CheckCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn, getRiskColor } from "@/lib/utils";
import type { Route, Shipment } from "@/lib/mock-data";
import { toast } from "sonner";

interface ShipmentPassProps {
  route: Route;
  shipment: Partial<Shipment> & {
    origin: string;
    destination: string;
    cargoType: string;
    vehicleType: string;
    shipmentCode: string;
  };
  onConfirm?: () => void;
  layoutId?: string;
}

type TearState = "idle" | "tearing" | "torn";

// Simple QR-like visual code block
function ShipmentCode({ code }: { code: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Pseudo-QR grid */}
      <div className="grid grid-cols-8 gap-0.5 p-2 bg-foreground/5 rounded border border-border/50">
        {Array.from({ length: 64 }).map((_, i) => {
          const seed = (i * 7 + code.charCodeAt(i % code.length)) % 3;
          return (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-[1px]",
                seed === 0
                  ? "bg-foreground/80"
                  : seed === 1
                    ? "bg-foreground/20"
                    : "bg-transparent",
              )}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground tracking-widest">
        {code}
      </span>
    </div>
  );
}

export function ShipmentPass({
  route,
  shipment,
  onConfirm,
  layoutId,
}: ShipmentPassProps) {
  const [tearState, setTearState] = useState<TearState>("idle");
  const riskColor = getRiskColor(route.riskLevel);

  const handleConfirm = () => {
    setTearState("tearing");
    setTimeout(() => {
      setTearState("torn");
      toast.success("Shipment dispatched", {
        description: `${shipment.origin} → ${shipment.destination} • ${shipment.shipmentCode}`,
      });
      setTimeout(() => {
        onConfirm?.();
      }, 800);
    }, 1200);
  };

  if (tearState === "torn") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 gap-4"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="w-14 h-14 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center"
        >
          <CheckCircle className="w-7 h-7 text-emerald-400" />
        </motion.div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            Shipment Dispatched
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Route locked · Decision recorded · Audit trail created
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {tearState === "tearing" && (
          <>
            {/* Top section slides up */}
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: -300, opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-x-0 top-0 h-1/2 bg-card z-20 origin-bottom"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
            />
            {/* Bottom stub slides out */}
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: 200, opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
              className="absolute inset-x-0 bottom-0 h-1/2 bg-card z-20"
            />
          </>
        )}
      </AnimatePresence>

      <motion.div
        layout
        layoutId={layoutId}
        className="rounded-lg border border-border bg-card overflow-hidden"
        animate={tearState === "tearing" ? { scale: 0.98 } : { scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Alert strip */}
        {route.riskLevel !== "low" && (
          <div className="bg-amber-400/10 border-b border-amber-400/20 px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400 font-medium">
              Risk Probability: {route.riskScore}% —{" "}
              {route.alerts[0] ?? "Monitor route conditions"}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span>{shipment.origin}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span>{shipment.destination}</span>
            </div>
            {route.recommended && (
              <Badge className="text-[10px] bg-primary/15 text-primary border-primary/25 gap-1">
                <Star className="w-2.5 h-2.5 fill-primary" />
                {route.name}
              </Badge>
            )}
            {!route.recommended && (
              <Badge variant="outline" className="text-[10px]">
                {route.name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Logistics Authorization · SentinelRoute
          </p>
        </div>

        {/* Core data block */}
        <div className="grid grid-cols-2 gap-px bg-border mx-5 my-4 rounded-md overflow-hidden border border-border">
          <div className="bg-card p-3">
            <p className="label-meta mb-1">ETA</p>
            <p className="text-xl font-bold text-foreground">{route.eta}</p>
          </div>
          <div className={cn("bg-card p-3")}>
            <p className="label-meta mb-1">Risk Score</p>
            <p className={cn("text-xl font-bold", riskColor)}>
              {route.riskScore}{" "}
              <span className="text-xs font-normal text-muted-foreground capitalize">
                / {route.riskLevel}
              </span>
            </p>
          </div>
          <div className="bg-card p-3">
            <p className="label-meta mb-1">Distance</p>
            <p className="text-sm font-bold text-foreground">
              {route.distance}
            </p>
          </div>
          <div className="bg-card p-3">
            <p className="label-meta mb-1">Dispatch</p>
            <p className="text-sm font-bold text-emerald-400 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Ready
            </p>
          </div>
        </div>

        {/* Risk bars */}
        <div className="px-5 mb-4 space-y-2">
          <p className="label-meta">Risk Factors</p>
          {Object.entries(route.riskBreakdown).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-24 capitalize shrink-0">
                {key === "cargoSensitivity"
                  ? "Cargo Sensitivity"
                  : key.charAt(0).toUpperCase() + key.slice(1)}
              </span>
              <Progress value={val} className="h-1 flex-1" />
              <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">
                {val}
              </span>
            </div>
          ))}
        </div>

        <Separator className="opacity-30 mx-5" />

        {/* Lower metadata */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          <div>
            <p className="label-meta mb-0.5">Shipment ID</p>
            <p className="text-xs font-mono font-semibold text-foreground">
              {shipment.shipmentCode}
            </p>
          </div>
          <div>
            <p className="label-meta mb-0.5">Confidence</p>
            <p className="text-xs font-semibold text-foreground">
              {shipment.confidencePercent ?? 82}%
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <Package className="w-3 h-3 text-muted-foreground" />
              <p className="label-meta">Cargo</p>
            </div>
            <p className="text-xs font-semibold text-foreground">
              {shipment.cargoType}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <Truck className="w-3 h-3 text-muted-foreground" />
              <p className="label-meta">Vehicle</p>
            </div>
            <p className="text-xs font-semibold text-foreground">
              {shipment.vehicleType}
            </p>
          </div>
        </div>

        {/* Identity / code block */}
        <div className="border-t border-dashed border-border/60 mx-5 pt-4 pb-4">
          <ShipmentCode code={shipment.shipmentCode} />
        </div>

        {/* Confirm CTA */}
        <div className="px-5 pb-5">
          <Button
            className="w-full h-10 font-semibold text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleConfirm}
            disabled={tearState === "tearing"}
          >
            {tearState === "tearing" ? (
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
    </div>
  );
}
