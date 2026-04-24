"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { KPI } from "@/lib/mock-data";

interface KPICardProps extends KPI {
  index?: number;
}

export function KPICard({ label, value, delta, deltaPositive, index = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.22 }}
      className="panel p-4 flex flex-col gap-3 hover:border-border/80 transition-colors"
    >
      <p className="label-meta">{label}</p>
      <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
      <p className={cn("text-xs font-medium", deltaPositive ? "text-emerald-400" : "text-red-400")}>
        {delta}
      </p>
    </motion.div>
  );
}
