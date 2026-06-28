import * as React from "react";
import { MapPin, Navigation, Search, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Mock data ────────────────────────────────────────────────────────────────

interface RideCostBubble {
  id: string;
  label: string;
  price: string;
  x: number; // % from left
  y: number; // % from top
  color: "electric" | "neon" | "gold";
}

const RIDE_BUBBLES: RideCostBubble[] = [
  { id: "b1", label: "Exclusiva", price: "R$ 24", x: 18, y: 28, color: "electric" },
  { id: "b2", label: "Rota Livre", price: "R$ 12", x: 68, y: 22, color: "neon" },
  { id: "b3", label: "Rota Fixa", price: "R$ 8", x: 78, y: 55, color: "neon" },
  { id: "b4", label: "Programada", price: "R$ 18", x: 20, y: 62, color: "gold" },
];

const BUBBLE_COLORS = {
  electric:
    "border-electric/60 bg-surface-2 text-electric [box-shadow:0_0_8px_oklch(0.72_0.22_246/0.3)]",
  neon: "border-neon/60 bg-surface-2 text-neon [box-shadow:0_0_8px_oklch(0.86_0.24_148/0.3)]",
  gold: "border-gold/60 bg-surface-2 text-gold [box-shadow:0_0_8px_oklch(0.84_0.16_88/0.3)]",
};

// ─── Animated map placeholder ─────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      role="img"
      aria-label="Mapa da região atual com motoristas disponíveis"
    >
      {/* Dark map base */}
      <div className="absolute inset-0 bg-[oklch(0.10_0.015_260)]" />

      {/* Grid lines simulating map tiles */}
      <svg
        className="absolute inset-0 h-full w-full opacity-20"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="oklch(0.28 0.025 262)"
              strokeWidth="1"
            />
          </pattern>
          {/* Main roads */}
          <pattern id="roads" width="160" height="160" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 80 160" fill="none" stroke="oklch(0.35 0.02 262)" strokeWidth="2" />
            <path d="M 0 80 L 160 80" fill="none" stroke="oklch(0.35 0.02 262)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#roads)" />
        {/* Curved "avenue" overlays */}
        <path
          d="M -20 180 Q 120 120 250 160 Q 360 200 480 140"
          fill="none"
          stroke="oklch(0.40 0.02 262)"
          strokeWidth="3"
          opacity="0.6"
        />
        <path
          d="M 20 60 Q 180 30 320 80 Q 420 110 500 60"
          fill="none"
          stroke="oklch(0.38 0.02 262)"
          strokeWidth="2.5"
          opacity="0.5"
        />
      </svg>

      {/* Subtle demand heatmap blobs */}
      <div
        className="absolute rounded-full opacity-15"
        aria-hidden="true"
        style={{
          width: 200,
          height: 200,
          top: "20%",
          left: "30%",
          background:
            "radial-gradient(circle, oklch(0.65 0.24 22 / 0.6) 0%, oklch(0.65 0.24 22 / 0) 70%)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        className="absolute rounded-full opacity-20"
        aria-hidden="true"
        style={{
          width: 140,
          height: 140,
          top: "65%",
          left: "72%",
          background:
            "radial-gradient(circle, oklch(0.72 0.22 246 / 0.5) 0%, oklch(0.72 0.22 246 / 0) 70%)",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Simulated idle vehicle dots */}
      {[
        { x: "35%", y: "42%" },
        { x: "55%", y: "30%" },
        { x: "22%", y: "55%" },
        { x: "70%", y: "48%" },
        { x: "45%", y: "68%" },
      ].map((pos, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="absolute h-3 w-3 rounded-full border-2 border-electric bg-surface-2"
          style={{
            left: pos.x,
            top: pos.y,
            transform: "translate(-50%, -50%)",
            animation: i % 2 === 0 ? "pulse 2.5s ease-in-out infinite" : undefined,
            animationDelay: `${i * 400}ms`,
          }}
        />
      ))}

      {/* User location pin */}
      <div
        className="absolute"
        aria-hidden="true"
        style={{ left: "50%", top: "52%", transform: "translate(-50%, -100%)" }}
      >
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-full bg-electric/30 animate-ping" />
        <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-electric shadow-[0_0_12px_oklch(0.72_0.22_246/0.7)]">
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Floating cost bubbles ────────────────────────────────────────────────────

function CostBubble({ bubble }: { bubble: RideCostBubble }) {
  return (
    <div
      className={cn(
        "absolute rounded-full border px-2.5 py-1 text-center",
        "transition-transform duration-200 hover:scale-105 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        BUBBLE_COLORS[bubble.color],
      )}
      style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, transform: "translate(-50%, -50%)" }}
      role="button"
      tabIndex={0}
      aria-label={`${bubble.label}: ${bubble.price}`}
    >
      <p className="text-[9px] font-semibold opacity-70 leading-none">{bubble.label}</p>
      <p className="text-sm font-bold leading-tight">{bubble.price}</p>
    </div>
  );
}

// ─── Bottom search/action panel ────────────────────────────────────────────────

interface BottomPanelProps {
  onSelectRide: () => void;
}

function BottomPanel({ onSelectRide }: BottomPanelProps) {
  const [address, setAddress] = React.useState("");

  return (
    <div
      className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-card/90 backdrop-blur-md px-4 pt-3 pb-5"
      style={{ boxShadow: "0 -8px 32px oklch(0 0 0 / 0.5)" }}
    >
      {/* Drag handle */}
      <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-border" aria-hidden="true" />

      {/* Address search */}
      <p className="text-xs text-muted-foreground mb-2 font-medium">Para onde vamos?</p>
      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Buscar destino..."
          aria-label="Buscar destino"
          className={cn(
            "w-full rounded-xl border border-border bg-surface-2",
            "pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card",
          )}
        />
      </div>

      {/* Quick address suggestions */}
      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none">
        {["Casa", "Trabalho", "Aeroporto", "Shopping"].map((place) => (
          <button
            key={place}
            onClick={() => setAddress(place)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 rounded-full border border-border bg-surface-3",
              "px-3 py-1.5 text-xs text-foreground hover:border-electric hover:text-electric transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label={`Ir para ${place}`}
          >
            <MapPin size={10} aria-hidden="true" />
            {place}
          </button>
        ))}
      </div>

      {/* CTA */}
      <Button
        variant="electric"
        size="xl"
        className="w-full rounded-2xl"
        onClick={onSelectRide}
        aria-label="Escolher tipo de corrida"
      >
        <Navigation size={18} aria-hidden="true" />
        Escolher corrida
        <ChevronUp size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

// ─── FABs ─────────────────────────────────────────────────────────────────────

function MapFABs() {
  return (
    <div className="absolute right-3 top-1/4 flex flex-col gap-2" aria-label="Controles do mapa">
      <button
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          "border border-border bg-surface-2 text-electric",
          "[box-shadow:0_4px_12px_oklch(0_0_0/0.5)]",
          "hover:bg-surface-3 active:scale-95 transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label="Re-centrar mapa na minha localização"
      >
        <Navigation size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── MapaVivo screen ──────────────────────────────────────────────────────────

interface MapaVivoProps {
  onSelectRide: () => void;
}

export function MapaVivo({ onSelectRide }: MapaVivoProps) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Full-bleed map */}
      <MapPlaceholder />

      {/* Floating ride cost bubbles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="pointer-events-auto">
          {RIDE_BUBBLES.map((bubble) => (
            <CostBubble key={bubble.id} bubble={bubble} />
          ))}
        </div>
      </div>

      {/* Map FABs */}
      <MapFABs />

      {/* Bottom action panel */}
      <BottomPanel onSelectRide={onSelectRide} />
    </div>
  );
}
