import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { ShoppingCart, Beef, Milk, Carrot, TrendingUp, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { EarningsCounter } from "./EarningsCounter";
import { PatronoCard } from "./PatronoCard";
import { ModeSliderCard } from "./ModeSliderCard";
import { TripCard } from "./TripCard";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverDashboardProps {
  isPatrono?: boolean;
  tier?: "prata" | "ouro" | "diamante";
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_EARNINGS = {
  today: 18750, // R$ 187,50
  week: 112400, // R$ 1.124,00
  month: 431200, // R$ 4.312,00
};

const MOCK_PATRONO = {
  monthlyEarnings: 87500, // R$ 875,00
  goalAmount: 100000, // R$ 1.000,00
  progressPercent: 87,
};

const MOCK_MODE_CARDS = [
  {
    mode: "hourly" as const,
    projectedEarning: 4500,
    actualEarning: 3200,
    tripCount: 3,
    isActive: true,
  },
  {
    mode: "daily" as const,
    projectedEarning: 30000,
    actualEarning: 18750,
    tripCount: 12,
    isActive: false,
  },
  {
    mode: "weekly" as const,
    projectedEarning: 150000,
    actualEarning: 112400,
    tripCount: 68,
    isActive: false,
  },
  {
    mode: "monthly" as const,
    projectedEarning: 500000,
    actualEarning: 431200,
    tripCount: 241,
    isActive: false,
  },
];

const MOCK_TRIPS = [
  {
    origin: "Av. Paulista, 1000",
    destination: "Aeroporto de Congonhas",
    fare: 4750,
    duration: 28,
    status: "completed" as const,
  },
  {
    origin: "Estação Consolação",
    destination: "Shopping Eldorado",
    fare: 2200,
    duration: 14,
    status: "completed" as const,
  },
  {
    origin: "Rua Augusta, 500",
    destination: "Av. Faria Lima, 3000",
    fare: 3100,
    duration: 19,
    status: "completed" as const,
  },
];

interface SupermarketCard {
  id: string;
  category: string;
  icon: React.ElementType;
  earnings: number; // BRL cents
  status: "disponível" | "em andamento" | "concluído";
}

const MOCK_SUPERMARKET_CARDS: SupermarketCard[] = [
  { id: "sm-1", category: "Açougue", icon: Beef, earnings: 2800, status: "disponível" },
  { id: "sm-2", category: "Laticínios", icon: Milk, earnings: 1950, status: "em andamento" },
  { id: "sm-3", category: "Hortifruti", icon: Carrot, earnings: 1600, status: "disponível" },
];

const STATUS_PILL_CLASS: Record<SupermarketCard["status"], string> = {
  disponível: "bg-neon/20 text-neon border border-neon/30",
  "em andamento": "bg-electric/20 text-electric border border-electric/30",
  concluído: "bg-surface-3 text-muted-foreground border border-border",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Haptic helper ─────────────────────────────────────────────────────────────

async function hapticMedium() {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // haptics only available on native
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DriverDashboard({ isPatrono = false, tier = "ouro" }: DriverDashboardProps) {
  const [isOnline, setIsOnline] = React.useState(true);
  const [supermarketMode, setSupermarketMode] = React.useState(false);
  const [showRipple, setShowRipple] = React.useState(false);

  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const handleToggleOnline = async () => {
    await hapticMedium();
    setIsOnline((prev) => !prev);
  };

  const handleToggleSupermarket = async (checked: boolean) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // haptics only available on native
    }
    setSupermarketMode(checked);
    if (checked && !prefersReduced) {
      setShowRipple(true);
      setTimeout(() => setShowRipple(false), 600);
    }
  };

  const handlePatronoCTA = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // haptics only available on native
    }
  };

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden scrollbar-none">
      {/* SupermarketMode ripple overlay */}
      <AnimatePresence>
        {showRipple && (
          <motion.div
            key="ripple"
            initial={{ opacity: 0.25 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 z-50 bg-gold/20"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-5 px-4 pt-4 pb-8">
        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              size="md"
              ring={isPatrono ? "gold" : isOnline ? "electric" : "none"}
              aria-label="Avatar do motorista"
            >
              <AvatarImage src="" alt="Foto do motorista" />
              <AvatarFallback variant={isPatrono ? "patron" : "driver"}>MJ</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display font-semibold text-sm text-foreground leading-tight">
                Marcos Júnior
              </p>
              {isPatrono && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-gold text-[10px]" aria-hidden="true">
                    ✦
                  </span>
                  <span className="font-display text-[10px] font-semibold text-gold tracking-widest uppercase">
                    Patrono {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Online / offline toggle */}
          <button
            type="button"
            aria-label="Ficar online / offline"
            aria-pressed={isOnline}
            onClick={handleToggleOnline}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isOnline
                ? "bg-neon/20 text-neon border-neon/40"
                : "bg-surface-2 text-muted-foreground border-border",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                isOnline ? "bg-neon" : "bg-muted-foreground",
              )}
              aria-hidden="true"
            />
            {isOnline ? "Online" : "Offline"}
          </button>
        </header>

        {/* ── Hero earnings row ── */}
        <section aria-label="Ganhos do dia">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
            Hoje
          </p>
          <EarningsCounter value={MOCK_EARNINGS.today} size="hero" colorClass="text-neon" />
          <div className="flex gap-4 mt-2">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                Semana
              </p>
              <EarningsCounter
                value={MOCK_EARNINGS.week}
                size="lg"
                colorClass="text-electric"
                className="text-xl"
              />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                Mês
              </p>
              <EarningsCounter
                value={MOCK_EARNINGS.month}
                size="lg"
                colorClass="text-foreground"
                className="text-xl"
              />
            </div>
          </div>
        </section>

        {/* ── Patrono card (conditional) ── */}
        {isPatrono && (
          <section aria-label="Status Patrono">
            <PatronoCard
              tier={tier}
              monthlyEarnings={MOCK_PATRONO.monthlyEarnings}
              goalAmount={MOCK_PATRONO.goalAmount}
              progressPercent={MOCK_PATRONO.progressPercent}
              onViewBenefits={handlePatronoCTA}
            />
          </section>
        )}

        {/* ── Mode slider cards ── */}
        <section aria-label="Modos de ganho">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-electric" aria-hidden="true" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Projeção de ganhos
            </p>
          </div>
          <div
            className="flex gap-3 overflow-x-auto scrollbar-none"
            style={{ scrollSnapType: "x mandatory" }}
            role="list"
            aria-label="Modos de ganho por período"
          >
            {MOCK_MODE_CARDS.map((card) => (
              <div key={card.mode} role="listitem" style={{ scrollSnapAlign: "center" }}>
                <ModeSliderCard
                  mode={card.mode}
                  projectedEarning={card.projectedEarning}
                  actualEarning={card.actualEarning}
                  tripCount={card.tripCount}
                  isActive={card.isActive}
                  className="w-56"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Recent trips ── */}
        <section aria-label="Corridas recentes">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Corridas recentes
          </p>
          <div className="flex flex-col gap-2" role="list">
            {MOCK_TRIPS.map((trip, i) => (
              <div key={i} role="listitem">
                <TripCard
                  origin={trip.origin}
                  destination={trip.destination}
                  fare={trip.fare}
                  duration={trip.duration}
                  status={trip.status}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Supermarket mode toggle ── */}
        <section aria-label="Modo Supermarket">
          <div
            className={cn(
              "rounded-2xl border p-4 transition-colors duration-300",
              supermarketMode
                ? "border-gold/40 bg-gradient-to-br from-surface to-surface-2 [box-shadow:0_0_12px_oklch(0.84_0.16_88/0.3)]"
                : "border-border bg-surface-2",
            )}
            style={supermarketMode ? { borderTop: "2px solid oklch(0.84 0.16 88)" } : undefined}
          >
            {/* Toggle row */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ShoppingCart
                  size={18}
                  className={supermarketMode ? "text-gold" : "text-muted-foreground"}
                  aria-hidden="true"
                />
                <div>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      supermarketMode ? "text-gold" : "text-foreground",
                    )}
                  >
                    Modo Supermarket
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Entregas em supermercados parceiros
                  </p>
                </div>
              </div>
              <Switch
                variant="supermarket"
                checked={supermarketMode}
                onCheckedChange={handleToggleSupermarket}
                aria-label="Ativar modo supermarket"
              />
            </div>

            {/* Supermarket cards — shown when active */}
            <AnimatePresence>
              {supermarketMode && (
                <motion.div
                  key="sm-cards"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="flex flex-col gap-2 mt-3"
                    role="list"
                    aria-label="Categorias supermarket"
                  >
                    {MOCK_SUPERMARKET_CARDS.map((card) => {
                      const Icon = card.icon;
                      return (
                        <div
                          key={card.id}
                          role="article"
                          aria-label={`${card.category}, ganho ${formatBRL(card.earnings)}`}
                          className="flex items-center gap-3 rounded-xl bg-surface-3 overflow-hidden"
                        >
                          {/* Gold left accent bar */}
                          <div className="w-1 self-stretch bg-gold shrink-0" aria-hidden="true" />
                          <div className="flex flex-1 items-center gap-3 py-3 pr-3">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10"
                              aria-hidden="true"
                            >
                              <Icon size={16} className="text-gold" />
                            </div>
                            <p className="flex-1 text-sm font-medium text-foreground">
                              {card.category}
                            </p>
                            {/* Earnings badge */}
                            <Badge variant="neon" className="text-[10px] font-bold shrink-0">
                              {formatBRL(card.earnings)}
                            </Badge>
                            {/* Status pill */}
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
                                STATUS_PILL_CLASS[card.status],
                              )}
                            >
                              {card.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ── Quick stats row ── */}
        <section aria-label="Estatísticas rápidas">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Avaliação", value: "4.97", icon: "⭐" },
              { label: "Corridas hoje", value: "12", icon: "🚗" },
              {
                label: "Aceite",
                value: "98%",
                icon: <Zap size={12} className="text-electric" aria-hidden="true" />,
              },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface-2 py-3 px-2"
              >
                <span className="text-base" aria-hidden="true">
                  {typeof icon === "string" ? icon : icon}
                </span>
                <span className="font-display font-bold text-sm text-foreground">{value}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
