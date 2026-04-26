import type * as React from "react";
import { cn } from "@/lib/utils";

// recharts v3 changed TooltipProps — use a compatible local type
interface RechartsTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; [key: string]: unknown }>;
  label?: string | number;
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config?: Record<string, { label: string; color: string }>;
}

export function ChartContainer({
  className,
  config,
  children,
  ...props
}: ChartContainerProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card p-3 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {config && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
          {Object.entries(config).map(([key, setting]) => (
            <div
              key={key}
              className="rounded-2xl border border-border/80 bg-muted/50 px-3 py-2"
            >
              <div className="font-semibold text-foreground">
                {setting.label}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {setting.color}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartTooltip({
  active,
  payload,
  label,
}: RechartsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-3xl border border-border bg-popover/95 p-3 text-[11px] text-muted-foreground shadow-xl backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 space-y-1">
        {payload.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="truncate text-[11px] text-foreground">
              {item.name}
            </span>
            <span className="font-semibold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartTooltipContent(props: RechartsTooltipProps) {
  return <ChartTooltip {...props} />;
}
