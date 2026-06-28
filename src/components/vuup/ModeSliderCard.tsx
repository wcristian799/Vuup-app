import * as React from "react";
import { EarningsCounter } from "./EarningsCounter";
import { cn } from "@/lib/utils";

type EarningsMode = "hourly" | "daily" | "weekly" | "monthly";

const MODE_LABEL: Record<EarningsMode, string> = {
  hourly: "Hora",
  daily: "Hoje",
  weekly: "Semana",
  monthly: "Mês",
};

interface ModeSliderCardProps {
  mode: EarningsMode;
  /** Projected earnings in BRL cents */
  projectedEarning: number;
  /** Actual earnings in BRL cents */
  actualEarning: number;
  tripCount: number;
  isActive: boolean;
  className?: string;
}

/**
 * ModeSliderCard — single card in the Matrix snap-scroll economic modes slider.
 */
export function ModeSliderCard({
  mode,
  projectedEarning,
  actualEarning,
  tripCount,
  isActive,
  className,
}: ModeSliderCardProps) {
  const progressPercent =
    projectedEarning > 0 ? Math.min(100, Math.round((actualEarning / projectedEarning) * 100)) : 0;

  return (
    <div
      role="group"
      aria-label={`Modo ${MODE_LABEL[mode]}`}
      className={cn(
        "flex-shrink-0 min-h-[180px] rounded-3xl border bg-surface-2 p-5 transition-all duration-200",
        isActive
          ? "border-electric [box-shadow:0_0_12px_oklch(0.72_0.22_246/0.4)]"
          : "border-border",
        className,
      )}
      style={{ width: "calc(100% - 48px)", scrollSnapAlign: "center" }}
    >
      {/* Mode label */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        {MODE_LABEL[mode]}
      </p>

      {/* Actual earnings */}
      <EarningsCounter value={actualEarning} size="lg" colorClass="text-neon" className="mb-0.5" />

      {/* Projected */}
      <p className="text-xs text-muted-foreground mb-3">
        de{" "}
        <span className="text-foreground font-medium">
          {(projectedEarning / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </span>{" "}
        projetado
      </p>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progressPercent}% da meta`}
        className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden mb-3"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-electric to-electric/80 transition-all duration-[600ms] ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Trip count */}
      <p className="text-xs text-muted-foreground">
        <span className="text-foreground font-semibold">{tripCount}</span> corridas
      </p>
    </div>
  );
}
