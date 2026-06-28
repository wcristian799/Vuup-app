import * as React from "react";
import { Check, Users, MapPin, Calendar, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Ride type data ───────────────────────────────────────────────────────────

export type RideTypeKey = "exclusiva" | "rota-livre" | "rota-fixa" | "rota-programada";

interface RideType {
  key: RideTypeKey;
  name: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  /** Price in BRL cents (stable, not computed) */
  basePrice: number;
  eta: string;
  badge?: string;
  badgeVariant?: "electric" | "neon" | "gold" | "default";
  color: "electric" | "neon" | "gold" | "ice";
  features: string[];
}

const RIDE_TYPES: RideType[] = [
  {
    key: "exclusiva",
    name: "Corrida Exclusiva",
    tagline: "Só para você",
    description: "Motorista dedicado, rota direta. Máximo conforto e privacidade.",
    icon: Zap,
    basePrice: 2400, // R$ 24,00
    eta: "3 min",
    badge: "Premium",
    badgeVariant: "electric",
    color: "electric",
    features: ["Rota direta", "Motorista dedicado", "Cancelamento grátis"],
  },
  {
    key: "rota-livre",
    name: "Rota Livre",
    tagline: "Compartilhada inteligente",
    description: "Compartilhe a corrida com outros passageiros e economize.",
    icon: Users,
    basePrice: 1200, // R$ 12,00
    eta: "5 min",
    badge: "Popular",
    badgeVariant: "neon",
    color: "neon",
    features: ["Até 3 passageiros", "Rota otimizada", "Mais econômica"],
  },
  {
    key: "rota-fixa",
    name: "Rota Fixa",
    tagline: "Linhas pré-definidas",
    description: "Corridas em rotas fixas de alta demanda. Preço tabelado.",
    icon: MapPin,
    basePrice: 800, // R$ 8,00
    eta: "7 min",
    color: "neon",
    features: ["Preço fixo", "Pontos de embarque", "Alta frequência"],
  },
  {
    key: "rota-programada",
    name: "Rota Programada",
    tagline: "Agende com antecedência",
    description: "Agende sua corrida com até 7 dias de antecedência. Garantido.",
    icon: Calendar,
    basePrice: 1800, // R$ 18,00
    eta: "Agendado",
    badge: "Agendável",
    badgeVariant: "gold",
    color: "gold",
    features: ["Até 7 dias antes", "Motorista confirmado", "Preço garantido"],
  },
];

// ─── Color mappings ───────────────────────────────────────────────────────────

const COLOR_MAP = {
  electric: {
    border: "border-electric",
    shadow: "[box-shadow:0_0_16px_oklch(0.72_0.22_246/0.4)]",
    text: "text-electric",
    icon: "text-electric",
    bg: "bg-electric/10",
    price: "text-electric",
  },
  neon: {
    border: "border-neon",
    shadow: "[box-shadow:0_0_16px_oklch(0.86_0.24_148/0.35)]",
    text: "text-neon",
    icon: "text-neon",
    bg: "bg-neon/10",
    price: "text-neon",
  },
  gold: {
    border: "border-gold",
    shadow: "[box-shadow:0_0_16px_oklch(0.84_0.16_88/0.4)]",
    text: "text-gold",
    icon: "text-gold",
    bg: "bg-gold/10",
    price: "text-gold",
  },
  ice: {
    border: "border-ice",
    shadow: "[box-shadow:0_0_12px_oklch(0.88_0.08_220/0.3)]",
    text: "text-ice",
    icon: "text-ice",
    bg: "bg-ice/10",
    price: "text-ice",
  },
};

// ─── Single ride type card ────────────────────────────────────────────────────

interface RideTypeCardProps {
  rideType: RideType;
  isSelected: boolean;
  onSelect: () => void;
}

function RideTypeCard({ rideType, isSelected, onSelect }: RideTypeCardProps) {
  const colors = COLOR_MAP[rideType.color];
  const Icon = rideType.icon;

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      aria-label={`${rideType.name}: ${rideType.tagline}, R$ ${(rideType.basePrice / 100).toFixed(2).replace(".", ",")}`}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex-shrink-0 rounded-3xl border bg-surface-2 p-5 cursor-pointer",
        "transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected
          ? [colors.border, colors.shadow, "scale-[1.01]"]
          : "border-border hover:border-border/80 hover:bg-surface-3",
      )}
      style={{
        width: "calc(100% - 48px)",
        minHeight: "180px",
        scrollSnapAlign: "center",
        flexShrink: 0,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {/* Icon badge */}
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", colors.bg)}>
            <Icon size={20} className={colors.icon} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">{rideType.name}</h3>
            <p className="text-xs text-muted-foreground leading-tight">{rideType.tagline}</p>
          </div>
        </div>

        {/* Selected checkmark or optional badge */}
        {isSelected ? (
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full",
              colors.bg,
              colors.border,
              "border",
            )}
            aria-hidden="true"
          >
            <Check size={12} className={colors.icon} />
          </div>
        ) : rideType.badge ? (
          <Badge variant={rideType.badgeVariant ?? "default"} className="text-[10px]">
            {rideType.badge}
          </Badge>
        ) : null}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{rideType.description}</p>

      {/* Price + ETA row */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className={cn("text-2xl font-extrabold font-display leading-none", colors.price)}>
            {(rideType.basePrice / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">tarifa base</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} aria-hidden="true" />
          <span>{rideType.eta}</span>
        </div>
      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-1.5">
        {rideType.features.map((feature) => (
          <span
            key={feature}
            className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            <Check size={8} className={colors.icon} aria-hidden="true" />
            {feature}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Number rain canvas (background decoration) ───────────────────────────────

function NumberRainCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  React.useEffect(() => {
    if (prefersReduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const COLS = Math.floor(W / 20);
    const drops: number[] = Array.from({ length: COLS }, () => Math.random() * H);

    ctx.font = "12px JetBrains Mono, monospace";

    let rafId: number;
    const draw = () => {
      ctx.fillStyle = "oklch(0.10 0.015 260 / 0.15)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "oklch(0.72 0.22 246 / 0.15)";

      for (let i = 0; i < drops.length; i++) {
        const digit = String(Math.floor(Math.random() * 10));
        ctx.fillText(digit, i * 20, drops[i]);
        if (drops[i] > H && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 14;
      }

      rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, [prefersReduced]);

  if (prefersReduced) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
      aria-hidden="true"
    />
  );
}

// ─── Dot indicators ───────────────────────────────────────────────────────────

function DotIndicators({
  total,
  active,
  colors,
}: {
  total: number;
  active: number;
  colors: (typeof COLOR_MAP)[keyof typeof COLOR_MAP][];
}) {
  return (
    <div className="flex justify-center gap-2 mt-3" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === active ? `w-5 ${colors[i]?.border ?? "border-electric"}` : "w-1.5 bg-border",
            i === active && "border-t-0 border-l-0 border-r-0",
          )}
          style={i === active ? { backgroundColor: "currentColor" } : undefined}
        />
      ))}
    </div>
  );
}

// ─── RideSelectorMatrix screen ────────────────────────────────────────────────

interface RideSelectorMatrixProps {
  onConfirm: (rideType: RideTypeKey) => void;
  destination?: string;
}

export function RideSelectorMatrix({
  onConfirm,
  destination = "Destino selecionado",
}: RideSelectorMatrixProps) {
  const [selectedKey, setSelectedKey] = React.useState<RideTypeKey>("exclusiva");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const selectedRide = RIDE_TYPES.find((r) => r.key === selectedKey)!;

  // Sync scroll position → active dot indicator
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / (el.scrollWidth / RIDE_TYPES.length));
    setActiveIndex(Math.max(0, Math.min(RIDE_TYPES.length - 1, idx)));
  };

  // Keyboard navigation for the slider
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / RIDE_TYPES.length;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      el.scrollBy({ left: cardWidth, behavior: "smooth" });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      el.scrollBy({ left: -cardWidth, behavior: "smooth" });
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Number rain background */}
      <NumberRainCanvas />

      {/* Header */}
      <div className="relative z-10 px-4 pt-2 pb-3">
        <h2 className="font-display text-lg font-bold text-foreground">Escolha sua corrida</h2>
        <div className="flex items-center gap-1.5 mt-0.5">
          <MapPin size={12} className="text-electric" aria-hidden="true" />
          <p className="text-xs text-muted-foreground truncate">{destination}</p>
        </div>
      </div>

      {/* Snap-scroll slider */}
      <div
        ref={scrollRef}
        role="radiogroup"
        aria-label="Tipos de corrida disponíveis"
        className="relative z-10 flex gap-3 overflow-x-auto scrollbar-none px-4 flex-1 items-start"
        style={{ scrollSnapType: "x mandatory" }}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
      >
        {RIDE_TYPES.map((rideType) => (
          <RideTypeCard
            key={rideType.key}
            rideType={rideType}
            isSelected={selectedKey === rideType.key}
            onSelect={() => setSelectedKey(rideType.key)}
          />
        ))}
        {/* Trailing spacer so last card centers */}
        <div className="w-6 flex-shrink-0" aria-hidden="true" />
      </div>

      {/* Dot indicators */}
      <div className="relative z-10">
        <DotIndicators
          total={RIDE_TYPES.length}
          active={activeIndex}
          colors={RIDE_TYPES.map((r) => COLOR_MAP[r.color])}
        />
      </div>

      {/* Confirm CTA */}
      <div className="relative z-10 px-4 pt-3 pb-5">
        <Button
          variant="electric"
          size="xl"
          className="w-full rounded-2xl"
          onClick={() => onConfirm(selectedKey)}
          aria-label={`Confirmar ${selectedRide.name} por ${(selectedRide.basePrice / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
        >
          Confirmar {selectedRide.name}
          <span className="ml-1 text-primary-foreground/80 text-sm font-normal">
            {(selectedRide.basePrice / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
        </Button>
      </div>
    </div>
  );
}
