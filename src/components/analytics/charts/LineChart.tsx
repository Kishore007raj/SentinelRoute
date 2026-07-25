"use client";

import React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface AnalyticsLineChartProps {
  title: string;
  data: unknown[];
  xAxisKey: string;
  lines: { key: string; name: string; color: string }[];
  isLoading?: boolean;
}

export const AnalyticsLineChart = React.memo(function AnalyticsLineChart({
  title,
  data,
  xAxisKey,
  lines,
  isLoading = false
}: AnalyticsLineChartProps) {
  return (
    <Card className="panel">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis 
                  dataKey={xAxisKey} 
                  stroke="var(--muted-foreground)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10} 
                />
                <YAxis 
                  stroke="var(--muted-foreground)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dx={-10} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "var(--popover)", 
                    borderColor: "var(--border)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" 
                  }}
                  itemStyle={{ color: "var(--foreground)" }}
                />
                {lines.map((line) => (
                  <Line 
                    key={line.key}
                    type="monotone" 
                    dataKey={line.key} 
                    name={line.name} 
                    stroke={line.color} 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: line.color, stroke: "var(--background)", strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
