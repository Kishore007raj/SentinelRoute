import { subMonths, subWeeks, subYears, startOfDay, endOfDay } from "date-fns";

export type DateRangePreset = "today" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "all";

export interface DateRange {
  start?: string; // ISO date string
  end?: string;   // ISO date string
  preset?: DateRangePreset;
}

/**
 * Builds a MongoDB date filter object based on the provided DateRange.
 * Assumes the field in the database stores ISO strings or Date objects that
 * can be compared with ISO strings.
 */
export function buildDateFilter(range?: DateRange): Record<string, unknown> | undefined {
  if (!range) return undefined;

  let start: Date | undefined;
  let end: Date | undefined;

  const now = new Date();

  if (range.preset && range.preset !== "all") {
    end = endOfDay(now);
    switch (range.preset) {
      case "today":
      case "daily":
        start = startOfDay(now);
        break;
      case "weekly":
        start = startOfDay(subWeeks(now, 1));
        break;
      case "monthly":
        start = startOfDay(subMonths(now, 1));
        break;
      case "quarterly":
        start = startOfDay(subMonths(now, 3));
        break;
      case "yearly":
        start = startOfDay(subYears(now, 1));
        break;
    }
  } else {
    if (range.start) start = new Date(range.start);
    if (range.end) end = new Date(range.end);
  }

  if (!start && !end) return undefined;

  const filter: Record<string, string | Date> = {};
  if (start) filter["$gte"] = start.toISOString();
  if (end) filter["$lte"] = end.toISOString();

  return filter;
}

export type TrendDirection = "up" | "down" | "flat";

export interface TrendAnalysis {
  delta: number;
  direction: TrendDirection;
  percent: number;
}

/**
 * Calculates trend between a current value and a previous value.
 */
export function calculateTrend(current: number, previous: number): TrendAnalysis {
  if (previous === 0) {
    return {
      delta: current,
      direction: current > 0 ? "up" : current < 0 ? "down" : "flat",
      percent: current > 0 ? 100 : 0
    };
  }

  const delta = current - previous;
  const percent = (delta / Math.abs(previous)) * 100;

  let direction: TrendDirection = "flat";
  if (delta > 0) direction = "up";
  if (delta < 0) direction = "down";

  return {
    delta,
    direction,
    percent: Math.abs(percent)
  };
}

/**
 * Calculates a simple moving average.
 */
export function calculateMovingAverage(values: number[], windowSize: number): (number | null)[] {
  if (windowSize <= 0 || values.length === 0) return values.map(() => null);

  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < windowSize - 1) {
      // Not enough data points for a full window yet
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += values[i - j];
    }
    result.push(sum / windowSize);
  }
  return result;
}
