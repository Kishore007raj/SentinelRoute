/**
 * use-debounce.ts
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * no change. Used for search inputs to avoid hammering the API on every keystroke.
 */
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
