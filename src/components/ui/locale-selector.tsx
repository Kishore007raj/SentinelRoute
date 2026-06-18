"use client";
/**
 * LocaleSelector — Dropdown for selecting the active UI language.
 *
 * Used in:
 *   - Settings page (User language preference)
 *   - Company settings (Company default language)
 *   - Driver profile (Driver language preference)
 *
 * Props:
 *   value       — current locale code
 *   onChange    — called with the new locale code
 *   onlyAllowed — optional array of allowed codes (restricts options)
 *   size        — "sm" | "md" (default "md")
 *   showScript  — show the native script name alongside English name
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LOCALES, LOCALE_INFO } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LocaleSelectorProps {
  value:        string;
  onChange:     (locale: SupportedLocale) => void;
  onlyAllowed?: string[];
  size?:        "sm" | "md";
  showScript?:  boolean;
  className?:   string;
  disabled?:    boolean;
}

export function LocaleSelector({
  value,
  onChange,
  onlyAllowed,
  size = "md",
  showScript = true,
  className,
  disabled,
}: LocaleSelectorProps) {
  const options = SUPPORTED_LOCALES
    .filter((code) => !onlyAllowed || onlyAllowed.includes(code))
    .map((code) => LOCALE_INFO[code]);

  return (
    <Select
      value={value}
      onValueChange={(v) => { if (v) onChange(v as SupportedLocale); }}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "bg-muted/20 border-border",
          size === "sm" ? "h-8 text-xs w-36" : "h-10 text-sm w-48",
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((info) => (
          <SelectItem key={info.code} value={info.code}>
            <div className="flex items-center gap-2">
              <span className={size === "sm" ? "text-xs" : "text-sm"}>
                {info.name}
              </span>
              {showScript && info.code !== "en" && (
                <span className="text-muted-foreground text-xs">
                  {info.nativeName}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
