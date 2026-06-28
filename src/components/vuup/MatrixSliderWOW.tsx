import * as React from "react";
import { cn } from "@/lib/utils";
import { EarningsCounter } from "./EarningsCounter";
import { NumberRainCanvas } from "./NumberRainCanvas";

/**
 * MatrixSliderWOW — full gamified earnings dashboard WOW interaction.
 *
 * Spec (MatrixSliderSpec):
 * - Hero earnings counter (neon, animated roll)
 * - Horizontal snap-scroll mode cards with peek
 * - Number rain canvas background (electric/15%, paused if reduced-motion)
 * - Sparkline SVG (7-day earnings)
 * - Full keyboard nav (arrow keys scroll snap)
 * - All a11y: aria-live, aria-label, role=group, etc.
 */

type EarningsMode = "hourly" | "daily" | "weekly" | "monthly";

const MODE_LABELS: Record<EarningsMode, string> = {
  hourly: "Por Hora",
  daily: "Hoje",
  weekly: "Esta Semana",
  monthly: "Este Mês",
};

const MODES: EarningsMode[] = ["hourly", "daily", "weekly", "monthly"];

const SAMPLE_DATA = {
  heroValue: 6200, // current hour in cents
  modes: {
    hourly: { projected: 8000, actual: 6200, trips: 8 },
    daily: { projected: 48000, actual: 31500, trips: 22 },
    weekly: { projected: 280000, actual: 198000, trips: 110 },
    monthly: { projected: 1200000, actual: 876000, trips: 445 },
  },
  sparkline: [320000, 285000, 410000, 376000, 450000, 398000, 312000], // 7 days, cents
};

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const W = 300;
  const H = 60;
  const PAD = 6;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((v - min) / range) * (H - PAD * 2),
  }));

  // Smooth cubic bezier path
  const path = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y} ${cx} ${pt.y} ${pt.x} ${pt.y}`;
  }, "");

  // Area fill path
  const areaPath = `${path} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Gráfico de ganhos dos últimos 7 dias"
    >
      <title>Ganhos dos últimos 7 dias</title>
      <desc>Linha mostrando variação de ganhos dos últimos sete dias de trabalho</desc>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.22 246)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="oklch(0.72 0.22 246)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill="url(#sparkGrad)" />
      {/* Line */}
      <path d={path} fill="none" stroke="oklch(0.72 0.22 246)" strokeWidth="2" />
      {/* Data points */}
      {pts.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="oklch(0.72 0.22 246)" opacity="0.7" />
      ))}
    </svg>
  );
}

// ─── Mode card ────────────────────────────────────────────────────────────────

function ModeCard({
  mode,
  data,
  isActive,
  index,
  visible,
}: {
  mode: EarningsMode;
  data: { projected: number; actual: number; trips: number };
  isActive: boolean;
  index: number;
  visible: boolean;
}) {
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const progress =
    data.projected > 0 ? Math.min(100, Math.round((data.actual / data.projected) * 100)) : 0;

  return (
    <div
      role="group"
      aria-label={`Modo ${MODE_LABELS[mode]}`}
      className={cn(
        "flex-shrink-0 min-h-[180px] rounded-3xl border p-5",
        isActive
          ? "border-electric [box-shadow:0_0_12px_oklch(0.72_0.22_246/0.4)]"
          : "border-border",
      )}
      style={{
        width: "calc(100% - 48px)",
        scrollSnapAlign: "center",
        background: "oklch(0.21 0.022 262)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: prefersReduced
          ? "none"
          : `opacity 350ms ease ${index * 80}ms, transform 350ms ease ${index * 80}ms`,
      }}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        {MODE_LABELS[mode]}
      </p>

      <EarningsCounter value={data.actual} size="lg" colorClass="text-neon" className="mb-0.5" />

      <p className="text-xs text-muted-foreground mb-3">
        de{" "}
        <span className="text-foreground font-medium">
          {(data.projected / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>{" "}
        projetado
      </p>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progress}% da meta`}
        className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden mb-3"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, oklch(0.72 0.22 246), oklch(0.72 0.22 246 / 0.8))",
            transition: "width 600ms cubic-bezier(0.2, 0.8, 0.4, 1)",
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="text-foreground font-semibold">{data.trips}</span> corridas
      </p>
    </div>
  );
}

// ─── Main WOW component ───────────────────────────────────────────────────────

export function MatrixSliderWOW({ className }: { className?: string }) {
  const [activeMode, setActiveMode] = React.useState<EarningsMode>("daily");
  const [heroValue, setHeroValue] = React.useState(SAMPLE_DATA.heroValue);
  const [cardsVisible, setCardsVisible] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Mount animation
  React.useEffect(() => {
    const t = setTimeout(() => setCardsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Keyboard arrow nav for slider
  const handleSliderKeyDown = (e: React.KeyboardEvent) => {
    const modes = MODES;
    const idx = modes.indexOf(activeMode);
    if (e.key === "ArrowRight" && idx < modes.length - 1) {
      const next = modes[idx + 1];
      setActiveMode(next);
      scrollRef.current
        ?.querySelector(`[data-mode="${next}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } else if (e.key === "ArrowLeft" && idx > 0) {
      const prev = modes[idx - 1];
      setActiveMode(prev);
      scrollRef.current
        ?.querySelector(`[data-mode="${prev}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  return (
    <div className={cn("relative flex flex-col gap-4", className)}>
      {/* Number rain background */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden"
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        <NumberRainCanvas className="opacity-100" />
      </div>

      <div className="relative z-10 flex flex-col gap-4">
        {/* Hero earnings counter */}
        <div className="text-center pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Ganhos agora
          </p>
          <EarningsCounter
            value={heroValue}
            size="hero"
            colorClass="text-neon"
            className="[text-shadow:0_0_20px_oklch(0.86_0.24_148/0.5)]"
          />
          <div className="flex gap-2 justify-center mt-2">
            <button
              className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setHeroValue((v) => Math.max(0, v - 500))}
              aria-label="Diminuir ganhos demo"
            >
              −R$5
            </button>
            <button
              className="rounded-full border border-electric/40 bg-electric/10 px-3 py-1.5 text-xs text-electric hover:bg-electric/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setHeroValue((v) => v + 1000)}
              aria-label="Aumentar ganhos demo"
            >
              +R$10
            </button>
          </div>
        </div>

        {/* Snap-scroll mode cards */}
        <div
          ref={scrollRef}
          role="region"
          aria-label="Modos de ganhos — use as setas para navegar"
          tabIndex={0}
          onKeyDown={handleSliderKeyDown}
          className="flex gap-3 overflow-x-auto scrollbar-none px-4 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {MODES.map((mode, i) => (
            <div key={mode} data-mode={mode} onClick={() => setActiveMode(mode)}>
              <ModeCard
                mode={mode}
                data={SAMPLE_DATA.modes[mode]}
                isActive={activeMode === mode}
                index={i}
                visible={cardsVisible}
              />
            </div>
          ))}
        </div>

        {/* Sparkline */}
        <div className="px-4">
          <div
            className="rounded-2xl border border-border p-4"
            style={{ background: "oklch(0.21 0.022 262)" }}
          >
            <p className="text-xs text-muted-foreground mb-2">Ganhos — últimos 7 dias</p>
            <Sparkline data={SAMPLE_DATA.sparkline} />
          </div>
        </div>
      </div>
    </div>
  );
}
