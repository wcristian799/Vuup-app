import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TripStatus = "pending" | "active" | "completed" | "cancelled";

interface TripCardProps {
  origin: string;
  destination: string;
  /** Fare in BRL cents */
  fare: number;
  /** Duration in minutes */
  duration: number;
  status: TripStatus;
  onPress?: () => void;
  className?: string;
}

const STATUS_LABEL: Record<TripStatus, string> = {
  pending: "Aguardando",
  active: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const STATUS_VARIANT: Record<TripStatus, "default" | "electric" | "neon" | "destructive"> = {
  pending: "electric",
  active: "neon",
  completed: "default",
  cancelled: "destructive",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * TripCard — summary card shown in map bottom panel and history lists.
 */
export function TripCard({
  origin,
  destination,
  fare,
  duration,
  status,
  onPress,
  className,
}: TripCardProps) {
  const isInteractive = !!onPress;

  return (
    <div
      role={isInteractive ? "button" : "article"}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={`Viagem de ${origin} para ${destination}, ${formatBRL(fare)}, ${duration} min, ${STATUS_LABEL[status]}`}
      onClick={onPress}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPress?.();
        }
      }}
      className={cn(
        "flex min-h-[72px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3",
        isInteractive &&
          "cursor-pointer transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
    >
      {/* Route line */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div className="h-2 w-2 rounded-full bg-electric" />
        <div className="w-0.5 h-5 bg-electric/40" />
        <div className="h-2 w-2 rounded-full border-2 border-electric bg-transparent" />
      </div>

      {/* Origin / destination */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{origin}</p>
        <p className="text-sm text-muted-foreground truncate">{destination}</p>
      </div>

      {/* Fare + duration + status */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-bold text-neon">{formatBRL(fare)}</span>
        <span className="text-xs text-muted-foreground">{duration} min</span>
        <Badge variant={STATUS_VARIANT[status]} className="text-[10px] px-1.5 py-0">
          {STATUS_LABEL[status]}
        </Badge>
      </div>
    </div>
  );
}
