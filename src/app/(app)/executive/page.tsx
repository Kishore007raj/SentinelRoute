"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCompany } from "@/lib/company-context";
import { HealthGauge } from "@/components/analytics/HealthGauge";
import { ExecutiveSummaryCards } from "@/components/analytics/ExecutiveSummaryCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Calendar, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExecutiveDashboardPage() {
  const { company } = useCompany();
  const [kpis, setKpis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchKPIs() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/analytics/kpis");
        if (res.ok) {
          const data = await res.json();
          setKpis(data);
        }
      } catch (error) {
        console.error("Failed to fetch KPIs:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (company?.companyId) {
      fetchKPIs();
    }
  }, [company]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Executive Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time intelligence and operational overview.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <Button variant="outline" className="gap-2 text-xs">
            <Calendar className="w-4 h-4" />
            Last 30 Days
          </Button>
          <Button className="btn-primary text-xs">
            Generate Report
          </Button>
        </motion.div>
      </div>

      {/* Main KPI Grid */}
      <ExecutiveSummaryCards kpis={kpis} isLoading={isLoading} />

      {/* Secondary Level: Health Score and Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Operational Health (Left - 1 col) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-1"
        >
          <Card className="panel h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Operational Health
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-6 pb-10 h-[calc(100%-4rem)]">
              {isLoading ? (
                <div className="w-48 h-48 rounded-full border-8 border-muted animate-pulse" />
              ) : (
                <HealthGauge score={kpis?.healthScore ?? 0} size="xl" />
              )}
              <p className="text-sm text-center text-muted-foreground mt-8 max-w-[200px]">
                Calculated based on delivery performance, risk levels, and fleet availability.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Placeholder for Charts (Right - 2 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="panel h-full">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--sr-amber)]" />
                  Performance Trends
                </CardTitle>
                <div className="flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <div className="h-2 w-2 rounded-full bg-[var(--sr-amber)]" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-[350px]">
              {/* This will be replaced in Phase 7 with real Recharts components */}
              <div className="text-center text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Chart components will be implemented in Phase 7</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}
