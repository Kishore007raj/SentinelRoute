import { differenceInCalendarDays, parseISO, startOfToday } from "date-fns";
import { Badge } from "@/components/ui/badge";

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Returns the number of calendar days between today and the given ISO expiry
 * date. Negative values mean the date has already passed.
 */
export function calcDaysUntil(expiry: string): number {
  return differenceInCalendarDays(parseISO(expiry), startOfToday());
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ExpiryBadgeProps {
  expiry: string;
  mode: "badge" | "indicator";
}

/**
 * ExpiryBadge — dual-mode expiry visualisation.
 *
 * **badge mode**
 * - `daysUntil <= 30`  → amber warning badge ("Expired" or "Expiring soon")
 * - `daysUntil > 30`   → renders nothing
 *
 * **indicator mode**
 * - `daysUntil < 0`              → red  ("Expired")
 * - `0 <= daysUntil <= 30`       → amber ("Expiring soon")
 * - `daysUntil > 30`             → green ("Valid")
 */
export function ExpiryBadge({ expiry, mode }: ExpiryBadgeProps) {
  const daysUntil = calcDaysUntil(expiry);

  // ── badge mode ─────────────────────────────────────────────────────────────
  if (mode === "badge") {
    if (daysUntil > 30) return null;

    const label = daysUntil < 0 ? "Expired" : "Expiring soon";
    return (
      <Badge className="bg-amber-400/10 text-amber-500 border-amber-400/30 dark:text-amber-400">
        {label}
      </Badge>
    );
  }

  // ── indicator mode ─────────────────────────────────────────────────────────
  if (daysUntil < 0) {
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/30 dark:text-red-400">
        Expired
      </Badge>
    );
  }

  if (daysUntil <= 30) {
    return (
      <Badge className="bg-amber-400/10 text-amber-500 border-amber-400/30 dark:text-amber-400">
        Expiring soon
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-400/10 text-emerald-600 border-emerald-400/30 dark:text-emerald-400">
      Valid
    </Badge>
  );
}
