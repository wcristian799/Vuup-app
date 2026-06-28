import * as React from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, MapPin, Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { apiClient } from "@/api/client";
import { MatrixSliderWOW } from "@/components/vuup/MatrixSliderWOW";
import { cn } from "@/lib/utils";
import type { Ride } from "@/api/types";

export const Route = createFileRoute("/rides")({
  component: RidesPage,
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/login" });
  },
});

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<
  Ride["status"],
  { label: string; icon: React.ElementType; color: string }
> = {
  searching: { label: "Buscando", icon: Clock, color: "text-gold" },
  accepted: { label: "Aceita", icon: CheckCircle2, color: "text-electric" },
  driver_en_route: { label: "Motorista a caminho", icon: MapPin, color: "text-electric" },
  in_progress: { label: "Em curso", icon: Layers, color: "text-neon" },
  completed: { label: "Concluída", icon: CheckCircle2, color: "text-neon" },
  cancelled: { label: "Cancelada", icon: XCircle, color: "text-muted-foreground" },
};

function RideRow({ ride }: { ride: Ride }) {
  const { label, icon: StatusIcon, color } = STATUS_CONFIG[ride.status] ?? STATUS_CONFIG.searching;
  const fare = ride.fareActual ?? ride.fareEstimate;

  return (
    <li className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn("text-xs font-medium flex items-center gap-1", color)}
          aria-label={`Status: ${label}`}
        >
          <StatusIcon size={12} aria-hidden="true" />
          {label}
        </span>
        <span className="text-sm font-bold text-foreground tabular-nums">
          {formatBRL(fare)}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <div className="h-2 w-2 rounded-full bg-neon mt-1 shrink-0" aria-hidden="true" />
          <p className="text-xs text-foreground truncate">{ride.origin.address}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="h-2 w-2 rounded-full bg-electric mt-1 shrink-0" aria-hidden="true" />
          <p className="text-xs text-foreground truncate">{ride.destination.address}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{ride.estimatedDistanceKm.toFixed(1)} km · {ride.estimatedDurationMin} min</span>
        <span>{formatDate(ride.createdAt)}</span>
      </div>
    </li>
  );
}

function RidesPage() {
  const [showNew, setShowNew] = React.useState(false);

  const ridesQuery = useQuery({
    queryKey: ["rides"],
    queryFn: () => apiClient.rides.list(),
  });

  const rides = ridesQuery.data?.data ?? [];

  if (showNew) {
    return (
      <main
        className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden flex flex-col"
        style={{ background: "var(--gradient-canvas)" }}
      >
        <header className="flex items-center gap-3 px-4 pt-12 pb-4 shrink-0">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-electric hover:border-electric transition-colors"
            onClick={() => setShowNew(false)}
            aria-label="Voltar à lista de corridas"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <Layers size={20} className="text-electric" aria-hidden="true" />
            Nova Corrida
          </h1>
        </header>
        <div className="flex-1 overflow-y-auto">
          <MatrixSliderWOW className="px-0 pt-2" />
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden flex flex-col"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-12 pb-4 shrink-0">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-electric hover:border-electric transition-colors"
          aria-label="Voltar ao início"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <Layers size={20} className="text-electric" aria-hidden="true" />
          Corridas
        </h1>
        <div className="flex-1" />
        <button
          className="text-xs font-semibold text-electric border border-electric/30 rounded-full px-3 py-1.5 hover:bg-electric/10 transition-colors"
          onClick={() => setShowNew(true)}
          aria-label="Solicitar nova corrida"
        >
          + Nova
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {ridesQuery.isPending ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-electric" aria-label="Carregando corridas" />
          </div>
        ) : ridesQuery.isError ? (
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 mt-4">
            <AlertCircle size={20} className="text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm text-destructive">Erro ao carregar corridas</p>
          </div>
        ) : rides.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="h-16 w-16 rounded-3xl bg-electric/10 border border-electric/20 flex items-center justify-center">
              <Layers size={28} className="text-electric" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Nenhuma corrida ainda.{" "}
              <button
                className="text-electric hover:underline"
                onClick={() => setShowNew(true)}
              >
                Solicitar agora
              </button>
            </p>
          </div>
        ) : (
          <ul className="space-y-3 pt-2" aria-label="Lista de corridas">
            {rides.map((ride) => (
              <RideRow key={ride.id} ride={ride} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
