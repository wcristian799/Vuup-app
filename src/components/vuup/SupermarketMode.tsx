import * as React from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EarningsCounter } from "./EarningsCounter";

/**
 * SupermarketMode — passive income cockpit with animated activation transition.
 *
 * Spec (SupermarketModeSpec):
 * - Phase 1 (0–400ms):  circular ripple from toggle, fills screen with gold/20
 * - Phase 2 (400–700ms): CSS class swap: --primary → gold, cross-fade all electric→gold
 * - Phase 3 (600–900ms): earning cards slide up from translateY(40px)→0, stagger 60ms
 * - Deactivation: reverse
 *
 * Respects prefers-reduced-motion (skips ripple, instant swap).
 */

interface EarningItem {
  id: string;
  icon: string;
  label: string;
  earnings: number; // cents
  status: "active" | "paused";
}

const SAMPLE_ITEMS: EarningItem[] = [
  { id: "grocery", icon: "🛒", label: "Mercado Livre Entrega", earnings: 48500, status: "active" },
  { id: "delivery", icon: "📦", label: "Delivery Rota Fixa", earnings: 32000, status: "active" },
  { id: "ads", icon: "📢", label: "VUUP Mídia no Carro", earnings: 19000, status: "active" },
  { id: "rental", icon: "🚗", label: "Aluguel de Rota", earnings: 8500, status: "paused" },
];

interface SupermarketModeProps {
  className?: string;
}

export function SupermarketMode({ className }: SupermarketModeProps) {
  const [active, setActive] = React.useState(false);
  const [rippleVisible, setRippleVisible] = React.useState(false);
  const [tokensSwapped, setTokensSwapped] = React.useState(false);
  const [cardsVisible, setCardsVisible] = React.useState(false);
  const toggleRef = React.useRef<HTMLDivElement>(null);

  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const handleToggle = (checked: boolean) => {
    if (prefersReduced) {
      setActive(checked);
      setTokensSwapped(checked);
      setCardsVisible(checked);
      return;
    }

    if (checked) {
      // Activate: Phase 1 → Phase 2 → Phase 3
      setActive(true);
      setRippleVisible(true);

      setTimeout(() => {
        setTokensSwapped(true);
        setRippleVisible(false);
      }, 400);

      setTimeout(() => {
        setCardsVisible(true);
      }, 600);
    } else {
      // Deactivate: Phase 3 exit → Phase 1 ripple collapse
      setCardsVisible(false);

      setTimeout(() => {
        setRippleVisible(true);
        setTokensSwapped(false);
      }, 200);

      setTimeout(() => {
        setRippleVisible(false);
        setActive(false);
      }, 600);
    }
  };

  return (
    <div
      className={cn("relative overflow-hidden rounded-3xl border bg-card p-5", className)}
      style={{
        borderColor: tokensSwapped ? "oklch(0.84 0.16 88 / 0.4)" : "oklch(0.28 0.025 262)",
        transition: "border-color 300ms ease",
      }}
    >
      {/* Ripple overlay — Phase 1 */}
      {rippleVisible && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-3xl overflow-hidden"
        >
          <div
            className="absolute left-1/2 top-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: active ? "300%" : "0%",
              paddingTop: active ? "300%" : "0%",
              background: "oklch(0.84 0.16 88 / 0.18)",
              transition:
                "width 400ms cubic-bezier(0.2, 0.8, 0.4, 1), padding-top 400ms cubic-bezier(0.2, 0.8, 0.4, 1)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      )}

      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4" ref={toggleRef}>
        <div>
          <h3
            className="font-display text-base font-semibold transition-colors duration-300"
            style={{ color: tokensSwapped ? "oklch(0.84 0.16 88)" : "oklch(0.98 0.005 240)" }}
          >
            {tokensSwapped ? "✦ Modo Supermarket" : "Modo Supermarket"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tokensSwapped ? "Renda passiva ativa" : "Ative para renda passiva"}
          </p>
        </div>
        <Switch
          variant="supermarket"
          checked={active}
          onCheckedChange={handleToggle}
          aria-label="Ativar modo supermarket"
        />
      </div>

      {/* Total passive earnings */}
      {tokensSwapped && (
        <div
          className="mb-4 rounded-2xl p-4 border transition-all duration-300"
          style={{
            background: "oklch(0.84 0.16 88 / 0.06)",
            borderColor: "oklch(0.84 0.16 88 / 0.25)",
          }}
        >
          <p className="text-xs text-muted-foreground mb-1">Renda passiva este mês</p>
          <EarningsCounter
            value={108000}
            size="lg"
            colorClass="text-gold"
            className="[text-shadow:0_0_16px_oklch(0.84_0.16_88/0.4)]"
          />
        </div>
      )}

      {/* Earning cards — Phase 3 */}
      <div className="space-y-2.5">
        {SAMPLE_ITEMS.map((item, i) => (
          <SupermarketCard
            key={item.id}
            item={item}
            visible={tokensSwapped && cardsVisible}
            delay={i * 60}
          />
        ))}
      </div>

      {/* Inactive state placeholder */}
      {!tokensSwapped && (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ative para ver suas fontes de renda passiva
          </p>
        </div>
      )}
    </div>
  );
}

function SupermarketCard({
  item,
  visible,
  delay,
}: {
  item: EarningItem;
  visible: boolean;
  delay: number;
}) {
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  return (
    <div
      role="article"
      aria-label={`${item.label}: ${(item.earnings / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, status: ${item.status === "active" ? "ativo" : "pausado"}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: prefersReduced
          ? "none"
          : `opacity 350ms ease ${delay}ms, transform 350ms cubic-bezier(0.2, 0.8, 0.4, 1) ${delay}ms`,
        borderColor: "oklch(0.84 0.16 88 / 0.25)",
        background: "oklch(0.21 0.022 262)",
      }}
      className={cn("relative flex items-center gap-3 rounded-2xl p-3 overflow-hidden", "border")}
    >
      {/* Left gold accent bar */}
      <div
        aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ background: "oklch(0.84 0.16 88)" }}
      />

      {/* Icon */}
      <span className="text-xl ml-1" aria-hidden="true">
        {item.icon}
      </span>

      {/* Label + status */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
        <span
          className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
          style={{
            background:
              item.status === "active"
                ? "oklch(0.86 0.24 148 / 0.15)"
                : "oklch(0.62 0.02 250 / 0.2)",
            color: item.status === "active" ? "oklch(0.86 0.24 148)" : "oklch(0.62 0.02 250)",
          }}
        >
          {item.status === "active" ? "Ativo" : "Pausado"}
        </span>
      </div>

      {/* Earnings */}
      <p
        className="text-sm font-bold tabular-nums shrink-0"
        style={{ color: "oklch(0.86 0.24 148)" }}
      >
        {(item.earnings / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
    </div>
  );
}
