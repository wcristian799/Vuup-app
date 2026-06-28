import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Zap } from "lucide-react";

import { StatusBar } from "@/components/vuup/StatusBar";
import { MapaVivo } from "@/components/vuup/MapaVivo";
import { MatrixSliderWOW } from "@/components/vuup/MatrixSliderWOW";
import { ShieldStatus } from "@/components/vuup/ShieldStatus";
import { SupermarketMode } from "@/components/vuup/SupermarketMode";
import { PatronoCard } from "@/components/vuup/PatronoCard";
import { PatronoUnlock } from "@/components/vuup/PatronoUnlock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wow")({
  component: WowGalleryPage,
});

type WowTab = "mapa" | "matrix" | "shield" | "supermarket" | "patrono";

const TABS: { key: WowTab; label: string; emoji: string }[] = [
  { key: "mapa", label: "Mapa Vivo", emoji: "🗺" },
  { key: "matrix", label: "Matrix", emoji: "⚡" },
  { key: "shield", label: "Escudo", emoji: "🛡" },
  { key: "supermarket", label: "Supermkt", emoji: "🛒" },
  { key: "patrono", label: "Patrono", emoji: "✦" },
];

function WowGalleryPage() {
  const [activeTab, setActiveTab] = React.useState<WowTab>("mapa");
  const [shieldState, setShieldState] = React.useState<"safe" | "warning" | "danger" | "off">(
    "safe",
  );
  const [showUnlock, setShowUnlock] = React.useState(false);

  const COMMUNITY_MEMBERS = [
    { id: "m1", label: "Motorista A1", type: "driver" as const },
    { id: "m2", label: "Motorista B2", type: "driver" as const },
    { id: "m3", label: "Patrono C3", type: "patron" as const },
    { id: "m4", label: "Motorista D4", type: "driver" as const },
    { id: "m5", label: "Passageiro E5", type: "passenger" as const },
    { id: "m6", label: "Motorista F6", type: "driver" as const },
    { id: "m7", label: "Motorista G7", type: "driver" as const },
    { id: "m8", label: "Patrono H8", type: "patron" as const },
  ];

  return (
    <main
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden text-foreground"
      style={{ background: "var(--gradient-canvas)" }}
    >
      {/* Status bar */}
      <StatusBar />

      {/* Patrono unlock overlay */}
      {showUnlock && <PatronoUnlock onDismiss={() => setShowUnlock(false)} />}

      {/* Header (non-map tabs) */}
      {activeTab !== "mapa" && (
        <div className="absolute top-8 inset-x-0 z-20 flex items-center gap-3 px-4 py-2">
          <Link
            to="/gallery"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-electric hover:border-electric transition-colors"
            aria-label="Voltar à galeria"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-display text-base font-bold text-foreground flex items-center gap-1.5">
            <Zap size={16} className="text-electric" aria-hidden="true" />
            WOW Interactions
          </h1>
        </div>
      )}

      {/* Mapa Vivo — full bleed */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-200",
          activeTab === "mapa"
            ? "opacity-100 pointer-events-auto z-10"
            : "opacity-0 pointer-events-none z-0",
        )}
        aria-hidden={activeTab !== "mapa"}
      >
        {/* Header overlay on map */}
        <div className="absolute top-8 inset-x-0 z-30 flex items-center gap-3 px-4 py-2">
          <Link
            to="/gallery"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-card/60 backdrop-blur-sm text-muted-foreground hover:text-electric transition-colors"
            aria-label="Voltar à galeria"
          >
            <ArrowLeft size={16} />
          </Link>
          <span className="font-display text-sm font-bold text-foreground px-3 py-1 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm flex items-center gap-1.5">
            <Zap size={14} className="text-electric" aria-hidden="true" />
            WOW · Mapa Vivo
          </span>
        </div>

        <MapaVivo onSelectRide={() => setActiveTab("matrix")} />
      </div>

      {/* Matrix Slider WOW */}
      <div
        className={cn(
          "absolute inset-0 pt-16 pb-24 overflow-y-auto transition-opacity duration-200",
          activeTab === "matrix"
            ? "opacity-100 pointer-events-auto z-10"
            : "opacity-0 pointer-events-none z-0",
        )}
        aria-hidden={activeTab !== "matrix"}
      >
        <MatrixSliderWOW className="px-0 pt-2" />
      </div>

      {/* Shield/Enxame */}
      <div
        className={cn(
          "absolute inset-0 pt-16 pb-24 overflow-y-auto transition-opacity duration-200",
          activeTab === "shield"
            ? "opacity-100 pointer-events-auto z-10"
            : "opacity-0 pointer-events-none z-0",
        )}
        aria-hidden={activeTab !== "shield"}
      >
        <div className="px-4 pt-2 space-y-4">
          {/* State controls */}
          <div
            className="rounded-2xl border border-border bg-card p-4"
            role="group"
            aria-label="Controles de estado do escudo"
          >
            <p className="text-xs text-muted-foreground mb-3">Estado do escudo</p>
            <div className="flex gap-2 flex-wrap">
              {(["safe", "warning", "danger", "off"] as const).map((s) => (
                <Button
                  key={s}
                  variant={shieldState === s ? "electric" : "outline"}
                  size="sm"
                  onClick={() => setShieldState(s)}
                  className="capitalize"
                  aria-pressed={shieldState === s}
                >
                  {s === "safe"
                    ? "Seguro"
                    : s === "warning"
                      ? "Alerta"
                      : s === "danger"
                        ? "Perigo"
                        : "Off"}
                </Button>
              ))}
            </div>
          </div>

          {/* Shield display */}
          <div className="rounded-3xl border border-border bg-card py-8 flex justify-center">
            <ShieldStatus
              state={shieldState}
              communityCount={COMMUNITY_MEMBERS.length}
              communityMembers={COMMUNITY_MEMBERS}
              onSOSPress={() => alert("SOS acionado!")}
            />
          </div>
        </div>
      </div>

      {/* Supermarket Mode */}
      <div
        className={cn(
          "absolute inset-0 pt-16 pb-24 overflow-y-auto transition-opacity duration-200",
          activeTab === "supermarket"
            ? "opacity-100 pointer-events-auto z-10"
            : "opacity-0 pointer-events-none z-0",
        )}
        aria-hidden={activeTab !== "supermarket"}
      >
        <div className="px-4 pt-2">
          <SupermarketMode />
        </div>
      </div>

      {/* Patrono Cards */}
      <div
        className={cn(
          "absolute inset-0 pt-16 pb-24 overflow-y-auto transition-opacity duration-200",
          activeTab === "patrono"
            ? "opacity-100 pointer-events-auto z-10"
            : "opacity-0 pointer-events-none z-0",
        )}
        aria-hidden={activeTab !== "patrono"}
      >
        <div className="px-4 pt-2 space-y-4">
          <PatronoCard
            tier="ouro"
            monthlyEarnings={1245000}
            goalAmount={1800000}
            progressPercent={69}
            onViewBenefits={() => setShowUnlock(true)}
          />
          <PatronoCard
            tier="diamante"
            monthlyEarnings={3180000}
            goalAmount={4000000}
            progressPercent={79}
          />
          <PatronoCard
            tier="prata"
            monthlyEarnings={524000}
            goalAmount={1200000}
            progressPercent={44}
          />

          {/* Demo unlock button */}
          <button
            className={cn(
              "w-full rounded-2xl border py-4 text-center font-display text-sm font-semibold transition-all",
              "border-gold/40 hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
            )}
            style={{ color: "oklch(0.84 0.16 88)" }}
            onClick={() => setShowUnlock(true)}
            aria-label="Ver animação de desbloqueio do Patrono"
          >
            ✦ Demo: Animação de Desbloqueio
          </button>
        </div>
      </div>

      {/* Bottom tab bar — WOW tabs */}
      <nav
        className="absolute bottom-0 inset-x-0 h-20 border-t border-border bg-card/80 backdrop-blur-sm z-20"
        aria-label="Navegação WOW interactions"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex h-full items-end pb-2">
          {TABS.map(({ key, label, emoji }) => {
            const isActive = activeTab === key;
            return (
              <li key={key} className="flex-1 relative">
                {isActive && <div className="tab-active-indicator" aria-hidden="true" />}
                <button
                  className={cn(
                    "flex w-full flex-col items-center gap-0.5 py-1 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    isActive ? "text-electric" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label={label}
                  aria-pressed={isActive}
                  onClick={() => setActiveTab(key)}
                >
                  <span className="text-base" aria-hidden="true">
                    {emoji}
                  </span>
                  <span className="text-[9px] font-medium leading-none">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </main>
  );
}
