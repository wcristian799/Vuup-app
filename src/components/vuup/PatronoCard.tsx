import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EarningsCounter } from "./EarningsCounter";
import { cn } from "@/lib/utils";

type PatronoTier = "prata" | "ouro" | "diamante";

const TIER_LABEL: Record<PatronoTier, string> = {
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
};

interface PatronoCardProps {
  tier: PatronoTier;
  /** Monthly earnings in BRL cents */
  monthlyEarnings: number;
  /** Goal in BRL cents */
  goalAmount: number;
  /** 0–100 */
  progressPercent: number;
  onViewBenefits?: () => void;
  className?: string;
}

/**
 * PatronoCard — premium Patrono tier card with gold palette and prestige motion.
 */
export function PatronoCard({
  tier,
  monthlyEarnings,
  goalAmount,
  progressPercent,
  onViewBenefits,
  className,
}: PatronoCardProps) {
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const goalFormatted = (goalAmount / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div
      role="article"
      aria-labelledby="patrono-metric patrono-label"
      className={cn(
        "relative overflow-hidden rounded-3xl p-5",
        "bg-gradient-to-br from-surface to-surface-2",
        "border border-gold/40",
        "[box-shadow:0_0_16px_oklch(0.84_0.16_88/0.45)]",
        "hover:scale-[1.015] active:scale-[0.985] transition-transform duration-200",
        "focus-within:ring-2 focus-within:ring-gold focus-within:ring-offset-2",
        className,
      )}
      style={{ borderTop: "2px solid oklch(0.84 0.16 88)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "text-gold font-display text-xs font-semibold tracking-[0.12em] uppercase",
              !prefersReduced && "inline-block animate-spin [animation-duration:4000ms]",
            )}
          >
            ✦
          </span>
          <span className="font-display text-xs font-semibold text-gold tracking-[0.12em] uppercase">
            Patrono
          </span>
        </div>
        <Badge variant="gold" className="text-xs">
          {TIER_LABEL[tier]}
        </Badge>
      </div>

      {/* Primary metric */}
      <div className="mb-1">
        <EarningsCounter
          value={monthlyEarnings}
          size="lg"
          colorClass="text-gold"
          className="[text-shadow:0_0_24px_oklch(0.92_0.1_88/0.5)]"
        />
      </div>
      <p id="patrono-label" className="text-xs text-muted-foreground mb-4">
        Rendimento passivo mensal
      </p>

      {/* Progress bar */}
      <div className="mb-1">
        <Progress
          value={progressPercent}
          variant="gold"
          size="md"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso para meta de rendimento"
        />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        <span className="text-gold font-semibold">{progressPercent}%</span> · Meta: {goalFormatted}
      </p>

      {/* CTA */}
      {onViewBenefits && (
        <Button
          variant="ghost"
          size="sm"
          className="text-gold hover:bg-gold/10 hover:text-gold px-0"
          aria-label="Ver benefícios do Plano Patrono"
          onClick={onViewBenefits}
        >
          Ver benefícios →
        </Button>
      )}
    </div>
  );
}
