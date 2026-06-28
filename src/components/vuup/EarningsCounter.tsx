import * as React from "react";
import { cn } from "@/lib/utils";

interface EarningsCounterProps {
  /** Value in BRL cents, e.g. 1234500 = R$ 12.345,00 */
  value: number;
  currency?: string;
  size?: "lg" | "hero";
  /** CSS color class name, defaults to text-neon */
  colorClass?: string;
  animateOnMount?: boolean;
  className?: string;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * EarningsCounter — animated rolling number display for monetary values.
 * Uses CSS counter animation for accessibility and performance.
 * Respects prefers-reduced-motion.
 */
export function EarningsCounter({
  value,
  currency = "R$",
  size = "hero",
  colorClass = "text-neon",
  animateOnMount = true,
  className,
}: EarningsCounterProps) {
  const [displayValue, setDisplayValue] = React.useState(animateOnMount ? 0 : value);
  const prevRef = React.useRef(animateOnMount ? 0 : value);
  const frameRef = React.useRef<number | null>(null);
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  React.useEffect(() => {
    if (prefersReduced) {
      setDisplayValue(value);
      prevRef.current = value;
      return;
    }

    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, prefersReduced]);

  const formatted = formatBRL(displayValue);

  return (
    <div
      aria-live="polite"
      aria-label={`Ganhos: ${currency} ${formatBRL(value)}`}
      className={cn(
        "font-display font-extrabold tabular-nums",
        colorClass,
        size === "hero" && "text-5xl",
        size === "lg" && "text-3xl",
        size === "hero" && "[text-shadow:0_0_20px_oklch(0.86_0.24_148/0.5)]",
        className,
      )}
    >
      <span className="text-[0.6em] mr-1 font-semibold opacity-80">{currency}</span>
      {formatted}
    </div>
  );
}
