import * as React from "react";
import { ShieldCheck, AlertTriangle, Phone, Users, Wifi, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommunityStatus = "active" | "limited" | "offline";

interface CommunityMember {
  id: string;
  label: string;
  type: "driver" | "patron" | "passenger";
  distance: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const COMMUNITY_MEMBERS: CommunityMember[] = [
  { id: "c1", label: "Motorista A1", type: "driver", distance: "120m" },
  { id: "c2", label: "Motorista B2", type: "driver", distance: "250m" },
  { id: "c3", label: "Patrono C3", type: "patron", distance: "380m" },
  { id: "c4", label: "Motorista D4", type: "driver", distance: "410m" },
  { id: "c5", label: "Passageiro E5", type: "passenger", distance: "520m" },
  { id: "c6", label: "Motorista F6", type: "driver", distance: "680m" },
  { id: "c7", label: "Motorista G7", type: "driver", distance: "730m" },
];

const MEMBER_COLORS: Record<CommunityMember["type"], { dot: string; label: string }> = {
  driver: { dot: "bg-electric", label: "text-electric" },
  patron: { dot: "bg-gold", label: "text-gold" },
  passenger: { dot: "bg-ice", label: "text-ice" },
};

// ─── Drag-to-activate panic control ──────────────────────────────────────────

interface DragPanicProps {
  onActivate: () => void;
}

function DragPanicControl({ onActivate }: DragPanicProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const thumbRef = React.useRef<HTMLDivElement>(null);

  const [dragX, setDragX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [activated, setActivated] = React.useState(false);
  const startXRef = React.useRef(0);
  const maxDragRef = React.useRef(0);

  const THUMB_W = 56;

  const getTrackMax = () => {
    if (!trackRef.current) return 0;
    return trackRef.current.offsetWidth - THUMB_W - 8;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activated) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    startXRef.current = e.clientX - dragX;
    maxDragRef.current = getTrackMax();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || activated) return;
    const newX = Math.max(0, Math.min(e.clientX - startXRef.current, maxDragRef.current));
    setDragX(newX);
    // Trigger when dragged > 85% of track
    if (newX >= maxDragRef.current * 0.85) {
      setIsDragging(false);
      setActivated(true);
      onActivate();
    }
  };

  const handlePointerUp = () => {
    if (!activated) {
      setIsDragging(false);
      // Snap back
      setDragX(0);
    }
  };

  const progress = maxDragRef.current > 0 ? dragX / maxDragRef.current : 0;

  return (
    <div className="px-4">
      <p className="text-xs text-muted-foreground text-center mb-3">
        Deslize para acionar emergência
      </p>
      <div
        ref={trackRef}
        className={cn(
          "relative h-14 w-full rounded-full border overflow-hidden",
          activated ? "border-danger bg-danger/20" : "border-danger/40 bg-surface-2",
        )}
        aria-label="Controle de pânico: deslize para direita para acionar emergência"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={activated ? "Emergência acionada" : "Deslize para ativar"}
      >
        {/* Fill track */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-danger/20 transition-none"
          style={{ width: activated ? "100%" : `${dragX + THUMB_W / 2}px` }}
          aria-hidden="true"
        />

        {/* Label */}
        {!activated && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <span
              className="text-sm font-semibold text-danger/60 transition-opacity"
              style={{ opacity: 1 - progress * 1.5 }}
            >
              SOS — Deslize →
            </span>
          </div>
        )}

        {activated && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <span className="text-sm font-bold text-danger">✓ Emergência acionada</span>
          </div>
        )}

        {/* Draggable thumb */}
        {!activated && (
          <div
            ref={thumbRef}
            className={cn(
              "absolute top-1 h-12 w-14 rounded-full",
              "bg-danger flex items-center justify-center",
              "[box-shadow:0_0_16px_oklch(0.65_0.24_22/0.7)]",
              "cursor-grab active:cursor-grabbing select-none",
              "transition-shadow",
              isDragging && "[box-shadow:0_0_24px_oklch(0.65_0.24_22/0.9)]",
            )}
            style={{ left: `${dragX + 4}px`, touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            aria-hidden="true"
          >
            <span className="text-white font-display font-bold text-base">SOS</span>
          </div>
        )}
      </div>

      {/* Keyboard fallback */}
      <button
        className={cn(
          "mt-2 w-full rounded-xl py-2.5 text-xs font-medium transition-colors",
          "border border-danger/30 text-danger/70 hover:border-danger hover:text-danger",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-danger-glow focus-visible:ring-offset-2",
        )}
        aria-label="Acionar alerta de emergência SOS (alternativa ao deslize)"
        onClick={() => {
          setActivated(true);
          onActivate();
        }}
      >
        Acionar SOS por toque
      </button>
    </div>
  );
}

// ─── SOS confirm dialog ───────────────────────────────────────────────────────

interface SOSDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function SOSDialog({ open, onClose, onConfirm }: SOSDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-confirm-title"
    >
      <div className="mx-4 max-w-[340px] w-full rounded-3xl border border-danger/50 bg-card p-6 [box-shadow:0_0_32px_oklch(0.65_0.24_22/0.4)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/20">
            <AlertTriangle size={20} className="text-danger" aria-hidden="true" />
          </div>
          <h2 id="sos-confirm-title" className="text-lg font-semibold text-danger">
            Confirmar SOS?
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Um alerta de emergência será enviado à comunidade VUUP próxima, equipe de suporte e
          contatos de emergência.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 rounded-xl bg-danger text-white hover:bg-danger/90"
            onClick={onConfirm}
          >
            Acionar SOS
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Community status card ─────────────────────────────────────────────────────

function CommunityStatusCard({
  members,
  status,
}: {
  members: CommunityMember[];
  status: CommunityStatus;
}) {
  const statusConfig = {
    active: { label: "Enxame ativo", color: "text-neon", badge: "neon" as const, icon: Wifi },
    limited: {
      label: "Cobertura limitada",
      color: "text-gold",
      badge: "gold" as const,
      icon: AlertTriangle,
    },
    offline: {
      label: "Sem cobertura",
      color: "text-muted-foreground",
      badge: "default" as const,
      icon: Wifi,
    },
  };

  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;
  const visibleMembers = members.slice(0, 4);

  return (
    <div className="mx-4 rounded-2xl border border-border bg-surface-2 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon size={16} className={cfg.color} aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Comunidade próxima</p>
        </div>
        <Badge variant={cfg.badge} className="text-[10px]">
          {cfg.label}
        </Badge>
      </div>

      {/* Member count */}
      <div className="flex items-center gap-1.5 mb-3">
        <Users size={14} className="text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">{members.length} membros</span>
        <span className="text-xs text-muted-foreground">no raio de 1km</span>
      </div>

      {/* Member list */}
      <div className="space-y-2" aria-label={`${members.length} membros da comunidade próximos`}>
        {visibleMembers.map((member) => {
          const mc = MEMBER_COLORS[member.type];
          return (
            <div key={member.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", mc.dot)} aria-hidden="true" />
                <span className="text-xs text-foreground">{member.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{member.distance}</span>
            </div>
          );
        })}
        {members.length > 4 && (
          <p className="text-xs text-muted-foreground pl-4">+{members.length - 4} outros membros</p>
        )}
      </div>
    </div>
  );
}

// ─── Safety tips ──────────────────────────────────────────────────────────────

function SafetyTips() {
  const tips = [
    { icon: ShieldCheck, text: "Verifique a placa e foto do motorista" },
    { icon: Phone, text: "Compartilhe sua viagem com alguém de confiança" },
    { icon: Users, text: "Prefira embarcar em locais iluminados" },
  ];

  return (
    <div className="mx-4 mt-3">
      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-2">
        Dicas de segurança
      </p>
      <div className="space-y-2">
        {tips.map(({ icon: Icon, text }) => (
          <button
            key={text}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl bg-surface-2 border border-border px-4 py-3",
              "hover:border-electric/40 hover:bg-surface-3 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "text-left",
            )}
          >
            <Icon size={16} className="text-electric shrink-0" aria-hidden="true" />
            <span className="text-xs text-foreground flex-1">{text}</span>
            <ChevronRight size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Safety Center screen ─────────────────────────────────────────────────────

export function SafetyCenter() {
  const [sosOpen, setSosOpen] = React.useState(false);
  const [sosActivated, setSosActivated] = React.useState(false);
  const communityStatus: CommunityStatus = "active";

  const handleDragActivate = () => {
    setSosOpen(true);
  };

  const handleSOSConfirm = () => {
    setSosOpen(false);
    setSosActivated(true);
    // In a real app: trigger emergency API call, vibration, etc.
  };

  const handleSOSCancel = () => {
    setSosOpen(false);
    // Would reset drag state in a more complete implementation
  };

  return (
    <>
      <div className="h-full overflow-y-auto pb-4">
        {/* Header */}
        <div className="px-4 pt-2 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-electric" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-foreground">Centro de Segurança</h2>
          </div>
          <p className="text-xs text-muted-foreground">Você está protegido pela comunidade VUUP</p>
        </div>

        {/* Shield status indicator */}
        <div
          className={cn(
            "mx-4 mb-4 rounded-2xl border p-4 flex items-center gap-3",
            sosActivated ? "border-danger/50 bg-danger/10" : "border-electric/40 bg-electric/5",
          )}
          aria-live="assertive"
          aria-atomic="true"
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              sosActivated ? "bg-danger/20" : "bg-electric/15",
            )}
          >
            {sosActivated ? (
              <AlertTriangle size={20} className="text-danger" aria-hidden="true" />
            ) : (
              <ShieldCheck size={20} className="text-electric" aria-hidden="true" />
            )}
          </div>
          <div>
            <p
              className={cn(
                "text-sm font-semibold",
                sosActivated ? "text-danger" : "text-electric",
              )}
            >
              {sosActivated ? "Alerta enviado" : "Protegido · Enxame ativo"}
            </p>
            <p className="text-xs text-muted-foreground">
              {sosActivated
                ? "Equipe de suporte notificada"
                : `${COMMUNITY_MEMBERS.length} membros no raio de 1km`}
            </p>
          </div>
        </div>

        {/* Community status */}
        <CommunityStatusCard members={COMMUNITY_MEMBERS} status={communityStatus} />

        {/* Drag-to-panic */}
        <div className="mt-5">
          {sosActivated ? (
            <div className="px-4">
              <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-center">
                <p className="text-sm font-semibold text-danger mb-1">✓ SOS Acionado</p>
                <p className="text-xs text-muted-foreground">
                  Suporte está a caminho. Mantenha-se em local seguro.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-danger/40 text-danger hover:bg-danger/10"
                  onClick={() => setSosActivated(false)}
                  aria-label="Cancelar alerta de emergência"
                >
                  Cancelar alerta
                </Button>
              </div>
            </div>
          ) : (
            <DragPanicControl onActivate={handleDragActivate} />
          )}
        </div>

        {/* Safety tips */}
        <SafetyTips />
      </div>

      {/* SOS confirmation dialog */}
      <SOSDialog open={sosOpen} onClose={handleSOSCancel} onConfirm={handleSOSConfirm} />
    </>
  );
}
