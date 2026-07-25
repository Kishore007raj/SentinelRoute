"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, Users, Activity, AlertTriangle, Lightbulb, TrendingUp, Building } from "lucide-react";

export function AnalyticsPageTemplate({ title, icon: Icon, description }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Icon className="w-8 h-8 text-primary" />
            {title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {description}
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] flex flex-col items-center justify-center text-center">
            <Icon className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-foreground">
              Detailed {title} visualization will be implemented in Phase 7.
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              The API for this domain is ready and serving aggregated MongoDB data. The UI components will replace this placeholder shortly.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
