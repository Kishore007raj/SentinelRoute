import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number[];
  onValueChange: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    { className, value, onValueChange, min = 0, max = 100, step = 1, ...props },
    ref,
  ) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = Number(event.target.value);
      onValueChange([nextValue]);
    };

    return (
      <input
        ref={ref}
        type="range"
        value={value[0] ?? 0}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:bg-slate-700/80",
          "accent-primary",
          className,
        )}
        {...props}
      />
    );
  },
);

Slider.displayName = "Slider";

export { Slider };
