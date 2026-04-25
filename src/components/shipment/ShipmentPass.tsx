"use client";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useState, useEffect } from "react";
import { Zap, AlertTriangle, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getRiskColor } from "@/lib/utils";
import type { Route, Shipment } from "@/lib/types";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

export type PassState = "idle" | "loading" | "success" | "error";

export interface ShipmentPassProps {
  route: Route;
  pending: {
    origin: string;
    destination: string;
    cargoType: string;
    vehicleType: string;
    urgency: string;
    deadline?: string;
  };
  onConfirm?: () => void;
}

function Barcode({ code }: { code: string }) {
  const [bars, setBars] = useState<{ width: number; height: number; dark: boolean }[]>([]);

  useEffect(() => {
    const generatedBars = Array.from({ length: 40 }, (_, i) => ({
      width: (i % 3 === 0) ? 3 : 1,
      height: 0.8 + Math.random() * 0.2,
      dark: Math.random() > 0.3
    }));
    setBars(generatedBars);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-end gap-px w-full h-10 px-2">
        {bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${b.height * 100}%`,
              backgroundColor: b.dark ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">{code}</span>
    </div>
  );
}

export function ShipmentPass({ route, pending, onConfirm }: ShipmentPassProps) {
  const [passState, setPassState] = useState<PassState>("idle");
  const { dispatchShipment } = useStore();
  const stripControls = useAnimation();
  const riskColor = getRiskColor(route.riskLevel);

  // Sync animation to success state
  useEffect(() => {
    if (passState === "success") {
      const runAnimation = async () => {
        await stripControls.start({
          y: [0, 50],
          opacity: [1, 0],
          transition: { duration: 0.5 }
        });
        if (onConfirm) onConfirm();
      };
      runAnimation();
    }
  }, [passState, stripControls, onConfirm]);

  const handleConfirm = async () => {
    if (passState === "loading" || passState === "success") return;

    setPassState("loading");
    
    try {
      await dispatchShipment({
        pending,
        route
      });

      // Show success ONLY after awaiting success
      setPassState("success");
      toast.success("Shipment dispatched successfully");
    } catch (error) {
      setPassState("error");
      toast.error("Failed to dispatch shipment");
      // Reset to idle after a delay so user can try again
      setTimeout(() => setPassState("idle"), 2000);
    }
  };

  return (
    <div className="relative max-w-md mx-auto">
      <div className="bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/5">
          <div className="flex justify-between items-center mb-6">
             <div className="text-left">
               <p className="text-[10px] uppercase tracking-tighter text-white/30">Origin</p>
               <p className="text-2xl font-black text-white">{pending.origin.slice(0,3).toUpperCase()}</p>
             </div>
             <ArrowRight className="text-white/20" />
             <div className="text-right">
               <p className="text-[10px] uppercase tracking-tighter text-white/30">Destination</p>
               <p className="text-2xl font-black text-white">{pending.destination.slice(0,3).toUpperCase()}</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase", riskColor, "bg-white/5 border border-white/10")}>
              {route.riskLevel} Risk
            </div>
            <div className="text-white/40 text-[10px] uppercase tracking-widest">{route.name}</div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 divide-x divide-white/5 border-b border-white/5">
          <div className="p-6">
            <p className="text-[10px] uppercase text-white/30 mb-1">Risk Score</p>
            <p className={cn("text-3xl font-black", riskColor)}>{route.riskScore}</p>
          </div>
          <div className="p-6">
            <p className="text-[10px] uppercase text-white/30 mb-1">Duration</p>
            <p className="text-3xl font-black text-white">{route.durationHours.toFixed(1)}h</p>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase text-white/30 mb-1">Cargo</p>
              <p className="text-xs font-semibold text-white/70">{pending.cargoType}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/30 mb-1">Vehicle</p>
              <p className="text-xs font-semibold text-white/70">{pending.vehicleType}</p>
            </div>
          </div>
        </div>

        {/* Barcode Section */}
        <motion.div animate={stripControls} className="p-6 border-t border-dashed border-white/10 bg-white/5">
          <Barcode code="SR-PENDING" />
        </motion.div>

        {/* Action */}
        <div className="p-6">
          <Button 
            onClick={handleConfirm}
            disabled={passState === "loading" || passState === "success"}
            className={cn(
              "w-full font-bold h-12 rounded-xl transition-all",
              passState === "success" ? "bg-emerald-600 hover:bg-emerald-500" : 
              passState === "error" ? "bg-red-600 hover:bg-red-500" :
              "bg-blue-600 hover:bg-blue-500 text-white"
            )}
          >
            {passState === "loading" ? "Processing..." : 
             passState === "success" ? "Success" :
             passState === "error" ? "Try Again" :
             "Confirm & Dispatch Shipment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
