"use client";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useState, useRef } from "react";
import { Shield, Zap, AlertTriangle, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getRiskColor } from "@/lib/utils";
import type { Route, Shipment } from "@/lib/mock-data";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PassState = "idle" | "confirming" | "confirmed" | "tearComplete" | "liveRouteReady";

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CITY_CODE: Record<string, string> = {
  Chennai: "MAA", Bangalore: "BLR", Mumbai: "BOM", Pune: "PNQ",
  Hyderabad: "HYD", Delhi: "DEL", Kolkata: "CCU", Coimbatore: "CJB",
};
function cityCode(name: string) {
  return CITY_CODE[name] ?? name.slice(0, 3).toUpperCase();
}

const ROUTE_ACCENT: Record<string, { bg: string; border: string; text: string }> = {
  balanced: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)", text: "rgba(147,197,253,0.9)" },
  safest:   { bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.22)", text: "rgba(110,231,183,0.9)" },
  fastest:  { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.22)", text: "rgba(253,230,138,0.9)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Barcode — wide, white-on-dark, realistic proportions
// ─────────────────────────────────────────────────────────────────────────────

function Barcode({ code, inverted = false }: { code: string; inverted?: boolean }) {
  // Deterministic bar pattern from shipment code
  const bars = Array.from({ length: 80 }, (_, i) => {
    const c1 = code.charCodeAt(i % code.length);
    const c2 = code.charCodeAt((i * 3) % code.length);
    const seed = (i * 17 + c1 * 7 + c2 * 3) % 11;
    const width = seed === 0 ? 4 : seed <= 2 ? 3 : seed <= 5 ? 2 : 1;
    const height = seed <= 1 ? 1 : seed <= 4 ? 0.72 : 0.85;
    const dark = seed <= 6;
    return { width, height, dark };
  });

  const fg = inverted ? "rgba(15,15,18,0.9)" : "rgba(255,255,255,0.88)";
  const fgLight = inverted ? "rgba(15,15,18,0.25)" : "rgba(255,255,255,0.22)";

  return (
    <div className="flex flex-col items-center gap-2.5 w-full">
      {/* Barcode bars */}
      <div className="flex items-end gap-px w-full h-14 px-2">
        {bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              maxWidth: b.width * 3,
              height: `${b.height * 100}%`,
              backgroundColor: b.dark ? fg : fgLight,
              minWidth: 1,
            }}
          />
        ))}
      </div>
      {/* Code label */}
      <span
        className="text-[10px] font-mono tracking-[0.3em] uppercase"
        style={{ color: inverted ? "rgba(15,15,18,0.5)" : "rgba(255,255,255,0.35)" }}
      >
        {code}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Perforation row
// ─────────────────────────────────────────────────────────────────────────────

function Perforation({ bright }: { bright: boolean }) {
  return (
    <div className="relative flex items-center w-full" style={{ height: 20 }}>
      {/* Left semicircle notch */}
      <div
        className="absolute -left-4 w-8 h-8 rounded-full transition-colors duration-300"
        style={{ background: bright ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}
      />
      {/* Right semicircle notch */}
      <div
        className="absolute -right-4 w-8 h-8 rounded-full transition-colors duration-300"
        style={{ background: bright ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}
      />
      {/* Dashed line */}
      <div
        className="w-full transition-all duration-300"
        style={{
          borderTop: bright
            ? "1.5px dashed rgba(255,255,255,0.35)"
            : "1.5px dashed rgba(255,255,255,0.10)",
        }}
      />
      {/* Scissors icon hint */}
      <span
        className="absolute right-6 text-[9px] uppercase tracking-[0.2em] transition-opacity duration-300"
        style={{ color: bright ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)" }}
      >
        tear
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatched stub — used in dashboard after tear
// ─────────────────────────────────────────────────────────────────────────────

export function DispatchedStub({
  shipment,
  route,
}: {
  shipment: ShipmentPassProps["shipment"];
  route: Route;
}) {
  const riskColor = getRiskColor(route.riskLevel);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg,#0f0f12,#111318)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[9px] text-white/25 uppercase tracking-[0.25em] mb-1">Dispatched</p>
          <div className="flex items-center gap-2 text-base font-black text-white">
            <span>{cityCode(shipment.origin)}</span>
            <span className="text-white/20 text-sm">→</span>
            <span>{cityCode(shipment.destination)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-xl font-black tabular-nums", riskColor)}>{route.riskScore}</p>
          <p className="text-[9px] text-white/30 uppercase tracking-widest">{route.eta}</p>
        </div>
      </div>
      <div
        className="mx-4 mb-4 rounded-lg px-4 py-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Barcode code={shipment.shipmentCode} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ShipmentPass
// ─────────────────────────────────────────────────────────────────────────────

export function ShipmentPass({ route, shipment, onConfirm, morphLayoutId }: ShipmentPassProps) {
  const [passState, setPassState] = useState<PassState>("idle");
  const stampControls = useAnimation();
  const stripControls = useAnimation();
  const riskColor = getRiskColor(route.riskLevel);
  const confidence = shipment.confidencePercent ?? 82;
  const accent = ROUTE_ACCENT[route.label] ?? ROUTE_ACCENT.balanced;
  const isBusy = passState !== "idle" && passState !== "tearComplete" && passState !== "liveRouteReady";

  const handleConfirm = async () => {
    if (passState !== "idle") return;

    // ── Step 1: Confirming ──────────────────────────────────────────────────
    setPassState("confirming");
    await new Promise((r) => setTimeout(r, 750));

    // ── Step 2: Stamp ───────────────────────────────────────────────────────
    setPassState("confirmed");
    await stampControls.start({
      opacity:    [0,    1,    1,    0.85],
      scale:      [1.35, 1.0,  1.0,  1.0 ],
      rotate:     [-7,   -3,   -3,   -3  ],
      transition: { duration: 0.4, ease: [0.2, 0, 0.2, 1] },
    });
    await new Promise((r) => setTimeout(r, 700));

    // ── Step 3: Tear ────────────────────────────────────────────────────────
    toast.success("Shipment dispatched", {
      description: `${shipment.origin} → ${shipment.destination} · ${shipment.shipmentCode}`,
    });

    // Strip tears away diagonally
    await stripControls.start({
      y:       [0,   4,   28,  60 ],
      x:       [0,   3,   12,  22 ],
      rotate:  [0,   0.5, 2,   3.5],
      opacity: [1,   1,   0.6, 0  ],
      scaleY:  [1,   1,   0.9, 0.7],
      transition: { duration: 0.7, ease: [0.4, 0, 0.8, 1], times: [0, 0.2, 0.7, 1] },
    });

    // ── Step 4: Done ────────────────────────────────────────────────────────
    setPassState("tearComplete");
    setTimeout(() => onConfirm?.(), 100);
  };

  // ── tearComplete success panel ────────────────────────────────────────────
  if (passState === "tearComplete") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0.2, 1] }}
        className="rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg,#0a120e,#0d1610)",
          border: "1px solid rgba(52,211,153,0.2)",
          boxShadow: "0 0 0 1px rgba(52,211,153,0.06), 0 24px 48px rgba(0,0,0,0.6)",
        }}
      >
        {/* Green top bar */}
        <div style={{ height: 3, background: "linear-gradient(90deg,rgba(52,211,153,0.6),rgba(52,211,153,0.2))" }} />

        <div className="px-8 py-8">
          {/* Icon + heading */}
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}
            >
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-400/60 uppercase tracking-[0.25em] mb-1">Authorization Complete</p>
              <p className="text-lg font-bold text-white leading-tight">Dispatch Confirmed</p>
            </div>
          </div>

          {/* Detail */}
          <div
            className="rounded-lg px-5 py-4 mb-6 space-y-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Order locked</p>
            <p className="text-sm font-mono text-white/60">{shipment.shipmentCode}</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Route {route.name} has been authorized and moved to active shipments. Audit record created.
            </p>
          </div>

          {/* Torn stub preview */}
          <div className="mb-6">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] mb-2">Dispatch token</p>
            <div
              className="rounded-lg px-4 py-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
            >
              <Barcode code={shipment.shipmentCode} />
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-2.5">
            <Button
              className="w-full h-11 text-sm font-semibold rounded-lg"
              style={{ background: "rgba(52,211,153,0.15)", color: "rgba(110,231,183,0.95)", border: "1px solid rgba(52,211,153,0.25)" }}
              onClick={() => setPassState("liveRouteReady")}
            >
              <MapPin className="w-4 h-4 mr-2" /> View Live Route
            </Button>
            <Button
              variant="ghost"
              className="w-full h-11 text-sm rounded-lg text-white/40 hover:text-white/70"
              onClick={() => onConfirm?.()}
            >
              Go to Your Orders
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Main pass ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      layoutId={morphLayoutId}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.2, 0, 0.2, 1], layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
      className="relative"
    >
      {/* ── PASS BODY ── */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg,#0f0f12 0%,#111318 55%,#0c0e11 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.7)",
        }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
            opacity: 0.018,
          }}
        />

        {/* Diagonal route-line texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(135deg,transparent,transparent 60px,rgba(255,255,255,0.012) 60px,rgba(255,255,255,0.012) 61px)",
          }}
        />

        {/* ── STAMP OVERLAY ── */}
        <AnimatePresence>
          {passState === "confirmed" && (
            <motion.div
              key="stamp"
              initial={{ opacity: 0, scale: 1.35, rotate: -7 }}
              animate={stampControls}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
              className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                style={{
                  padding: "14px 32px",
                  border: "3px solid rgba(52,211,153,0.65)",
                  borderRadius: 4,
                  color: "rgba(52,211,153,0.88)",
                  fontFamily: "'Courier New', monospace",
                  fontSize: "1.4rem",
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  textShadow: "0 0 24px rgba(52,211,153,0.5)",
                  boxShadow: "0 0 0 1px rgba(52,211,153,0.12), inset 0 0 32px rgba(52,211,153,0.06)",
                  background: "rgba(0,0,0,0.72)",
                  backdropFilter: "blur(6px)",
                }}
              >
                DISPATCH CONFIRMED
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RISK ALERT STRIP ── */}
        {route.riskLevel !== "low" && (
          <div
            className="flex items-center gap-2.5 px-6 py-2.5"
            style={{
              background: "rgba(251,191,36,0.05)",
              borderBottom: "1px solid rgba(251,191,36,0.12)",
            }}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "rgba(251,191,36,0.7)" }} />
            <span className="text-[10px] tracking-wide" style={{ color: "rgba(251,191,36,0.6)" }}>
              Risk Probability: {route.riskScore}% — {route.alerts[0] ?? "Monitor route conditions"}
            </span>
          </div>
        )}

        {/* ── HEADER: CITY CODES ── */}
        <div
          className="px-7 pt-7 pb-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[9px] uppercase tracking-[0.32em] mb-5" style={{ color: "rgba(255,255,255,0.22)" }}>
            Logistics Authorization · SentinelRoute
          </p>

          {/* Origin / ETA / Destination */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p
                className="font-black leading-none tracking-tight"
                style={{ fontSize: "2.6rem", color: "rgba(255,255,255,0.95)" }}
              >
                {cityCode(shipment.origin)}
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{shipment.origin}</p>
            </div>

            <div className="flex flex-col items-center gap-1.5 pt-3 flex-1 px-2">
              <div className="flex items-center gap-1 w-full">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
                <ArrowRight className="w-3 h-3 shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
              </div>
              <p className="text-sm font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.55)" }}>
                {route.eta}
              </p>
            </div>

            <div className="text-right">
              <p
                className="font-black leading-none tracking-tight"
                style={{ fontSize: "2.6rem", color: "rgba(255,255,255,0.95)" }}
              >
                {cityCode(shipment.destination)}
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{shipment.destination}</p>
            </div>
          </div>

          {/* Route badge */}
          <div className="flex items-center gap-2.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded"
              style={{ background: accent.bg, border: `1px solid ${accent.border}`, color: accent.text }}
            >
              {route.name}
            </span>
            {route.recommended && (
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>
                · Recommended
              </span>
            )}
          </div>
        </div>

        {/* ── METRICS ROW ── */}
        <div
          className="grid grid-cols-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="px-7 py-5" style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] uppercase tracking-[0.22em] mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Risk</p>
            <p className={cn("text-3xl font-black tabular-nums leading-none", riskColor)}>{route.riskScore}</p>
            <p className={cn("text-[10px] mt-1 capitalize tracking-wide", riskColor)}>{route.riskLevel} Risk</p>
          </div>
          <div className="px-7 py-5">
            <p className="text-[9px] uppercase tracking-[0.22em] mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Confidence</p>
            <p className="text-3xl font-black tabular-nums leading-none" style={{ color: "rgba(255,255,255,0.9)" }}>{confidence}%</p>
            <p className="text-[10px] mt-1 tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>Decision</p>
          </div>
        </div>

        {/* ── DETAIL GRID ── */}
        <div
          className="px-7 py-5 grid grid-cols-2 gap-x-8 gap-y-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Shipment ID — full width */}
          <div className="col-span-2">
            <p className="text-[9px] uppercase tracking-[0.22em] mb-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>Shipment ID</p>
            <p className="text-xs font-mono font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{shipment.shipmentCode}</p>
          </div>
          {[
            ["Cargo",    shipment.cargoType],
            ["Vehicle",  shipment.vehicleType],
            ["Distance", route.distance],
            ["Dispatch", "Ready"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[9px] uppercase tracking-[0.22em] mb-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>{label}</p>
              <p
                className="text-xs font-semibold"
                style={{ color: label === "Dispatch" ? "rgba(52,211,153,0.8)" : "rgba(255,255,255,0.6)" }}
              >
                {label === "Dispatch" ? (
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> {value}
                  </span>
                ) : value}
              </p>
            </div>
          ))}
        </div>

        {/* ── PERFORATION ── */}
        <div className="px-4 py-1">
          <Perforation bright={passState === "confirmed"} />
        </div>

        {/* ── BARCODE TEAR STRIP ── */}
        <motion.div
          animate={stripControls}
          style={{ transformOrigin: "top center" }}
          className="relative"
        >
          {/* Glow sweep on entry */}
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "120%", opacity: [0, 0.15, 0] }}
            transition={{ delay: 0.3, duration: 0.9, ease: "easeInOut" }}
            className="absolute inset-0 pointer-events-none z-10"
            style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)", skewX: -15 }}
          />

          <div
            className="mx-4 my-4 rounded-lg px-5 py-5"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.18)" }}>
                Dispatch Token
              </p>
              <p className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.18)" }}>
                Detach on Dispatch
              </p>
            </div>
            <Barcode code={shipment.shipmentCode} />
          </div>
        </motion.div>

        {/* ── CTA ── */}
        <div className="px-6 pb-6 pt-0">
          <Button
            className={cn(
              "w-full h-11 font-semibold text-sm rounded-lg transition-all duration-200",
            )}
            style={
              isBusy
                ? { background: "rgba(52,211,153,0.12)", color: "rgba(110,231,183,0.8)", border: "1px solid rgba(52,211,153,0.2)", cursor: "not-allowed" }
                : {}
            }
            variant={isBusy ? "ghost" : "default"}
            onClick={passState === "idle" ? handleConfirm : undefined}
            disabled={isBusy}
          >
            {passState === "confirming" ? (
              <span className="flex items-center gap-2.5">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.65, ease: "linear" }}
                  className="w-3.5 h-3.5 rounded-full border-2"
                  style={{ borderColor: "rgba(52,211,153,0.25)", borderTopColor: "rgba(52,211,153,0.85)" }}
                />
                Locking Route...
              </span>
            ) : passState === "confirmed" ? (
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" /> Dispatching...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" /> Confirm &amp; Dispatch Shipment
              </span>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
