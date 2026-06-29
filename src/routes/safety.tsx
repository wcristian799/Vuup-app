import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { apiClient } from "@/api/client";
import { ShieldStatus } from "@/components/vuup/ShieldStatus";
import { cn } from "@/lib/utils";
import type { SafetyEvent } from "@/api/types";

export const Route = createFileRoute("/safety")({
  component: SafetyPage,
  // No auth guard (VUU-82): freely navigable.
});

const EVENT_TYPE_LABELS: Record<string, string> = {
  sos_triggered: "SOS Acionado",
  route_deviation: "Desvio de Rota",
  speed_alert: "Alerta de Velocidade",
  community_report: "Reporte da Comunidade",
  police_checkpoint: "Blitz Policial",
  road_hazard: "Perigo na Via",
};

function EventCard({ event }: { event: SafetyEvent }) {
  const label = EVENT_TYPE_LABELS[event.type] ?? event.type;
  return (
    <li className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            event.isResolved
              ? "bg-surface-2 text-muted-foreground"
              : "bg-destructive/10 text-destructive border border-destructive/20",
          )}
          aria-label={event.isResolved ? "Resolvido" : "Ativo"}
        >
          {event.isResolved ? "Resolvido" : "Ativo"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {new Date(event.createdAt).toLocaleDateString("pt-BR")}
        </span>
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {event.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
      )}
      {event.upvotes > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {event.upvotes} confirmação{event.upvotes !== 1 ? "ões" : ""}
        </p>
      )}
    </li>
  );
}

function SafetyPage() {
  const eventsQuery = useQuery({
    queryKey: ["safety", "events"],
    queryFn: () => apiClient.safety.events(),
  });

  const events = eventsQuery.data?.data ?? [];
  // Derive shield state from active events
  const activeCount = events.filter((e) => !e.isResolved).length;
  const hasSos = events.some((e) => e.type === "sos_triggered" && !e.isResolved);
  const shieldState = hasSos
    ? "danger"
    : activeCount > 2
      ? "warning"
      : activeCount > 0
        ? "warning"
        : "safe";

  // Community members mock (nearby users - would come from presence API)
  const COMMUNITY_MEMBERS = [
    { id: "c1", label: "Motorista próximo", type: "driver" as const },
    { id: "c2", label: "Patrono", type: "patron" as const },
    { id: "c3", label: "Passageiro", type: "passenger" as const },
  ];

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
          <ShieldCheck size={20} className="text-electric" aria-hidden="true" />
          Segurança
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* Shield widget */}
        <div className="rounded-3xl border border-border bg-card py-8 flex justify-center">
          <ShieldStatus
            state={shieldState}
            communityCount={COMMUNITY_MEMBERS.length}
            communityMembers={COMMUNITY_MEMBERS}
            onSOSPress={() => {
              // In production: call apiClient.safety.sos(...)
              alert("SOS acionado! Ajuda a caminho.");
            }}
          />
        </div>

        {/* Events list */}
        <div className="rounded-3xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Eventos na área ({events.length})
          </h2>

          {eventsQuery.isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-electric" aria-label="Carregando eventos" />
            </div>
          ) : eventsQuery.isError ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-destructive/30 bg-destructive/5">
              <AlertCircle size={16} className="text-destructive shrink-0" aria-hidden="true" />
              <p className="text-sm text-destructive">Erro ao carregar eventos</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <ShieldCheck size={28} className="text-neon" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Área segura. Sem ocorrências.</p>
            </div>
          ) : (
            <ul className="space-y-3" aria-label="Lista de eventos de segurança">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
