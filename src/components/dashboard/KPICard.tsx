"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface KPI {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
}

interface KPICardProps extends KPI {
  index?: number;
}

export function KPICard({ label, value, delta, deltaPositive, index = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.22 }}
      className="panel p-5 flex flex-col gap-3 hover:border-border/80 transition-all shadow-sm"
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-4xl font-black tracking-tight text-foreground tabular-nums">{value}</p>
      {delta && (
        <p className={cn("text-xs font-bold tracking-tight", deltaPositive ? "text-emerald-400" : "text-amber-400")}>
          {delta}
        </p>
      )}
    </motion.div>
  );
}
