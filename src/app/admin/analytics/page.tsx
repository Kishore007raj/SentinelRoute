"use client";

import { BarChart3, TrendingUp, Users, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalAnalyticsCenter() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-500" />
            Platform Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cross-tenant growth, retention, and performance metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border/50 shadow-sm md:col-span-2 min-h-[400px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Advanced BI Analytics Dashboard</p>
            <p className="text-xs mt-1 opacity-70">Coming in Q4</p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" /> User Growth (MoM)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">+12.4%</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Package className="w-4 h-4" /> Volume (MoM)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">+28.1%</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
